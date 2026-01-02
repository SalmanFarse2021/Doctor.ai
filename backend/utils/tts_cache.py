"""
TTS Cache Layer
In-memory caching for generated TTS audio to reduce API calls and improve performance
"""
import hashlib
import time
from typing import Optional, Dict, Tuple, List
from cachetools import TTLCache
import threading


class TTSCache:
    """Thread-safe TTS cache with TTL and metrics"""
    
    def __init__(self, maxsize: int = 1000, ttl: int = 86400):
        """
        Initialize TTS cache
        
        Args:
            maxsize: Maximum number of cached items
            ttl: Time-to-live in seconds (default: 24 hours)
        """
        self.cache = TTLCache(maxsize=maxsize, ttl=ttl)
        self.lock = threading.Lock()
        
        # Metrics
        self.hits = 0
        self.misses = 0
        self.total_generation_time = 0.0
        self.generation_count = 0
    
    def _make_key(self, model: str, voice: str, text: str) -> str:
        """
        Generate cache key from TTS parameters
        
        Args:
            model: TTS model name
            voice: Voice name
            text: Normalized text
        
        Returns:
            Cache key string
        """
        # Hash the text for consistent key length
        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
        return f"{model}:{voice}:{text_hash}"
    
    def get(self, model: str, voice: str, text: str) -> Optional[bytes]:
        """
        Get cached audio
        
        Args:
            model: TTS model
            voice: Voice name
            text: Normalized text
        
        Returns:
            Audio bytes if cached, None otherwise
        """
        key = self._make_key(model, voice, text)
        
        with self.lock:
            audio = self.cache.get(key)
            if audio is not None:
                self.hits += 1
                return audio
            else:
                self.misses += 1
                return None
    
    def set(self, model: str, voice: str, text: str, audio: bytes, generation_time: float = 0.0):
        """
        Cache audio
        
        Args:
            model: TTS model
            voice: Voice name
            text: Normalized text
            audio: Audio bytes
           generation_time: Time taken to generate (for metrics)
        """
        key = self._make_key(model, voice, text)
        
        with self.lock:
            self.cache[key] = audio
            
            # Update metrics
            if generation_time > 0:
                self.total_generation_time += generation_time
                self.generation_count += 1
    
    def get_stats(self) -> Dict[str, any]:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache metrics
        """
        with self.lock:
            total_requests = self.hits + self.misses
            hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
            avg_gen_time = (self.total_generation_time / self.generation_count) if self.generation_count > 0 else 0
            
            return {
                "cache_size": len(self.cache),
                "max_size": self.cache.maxsize,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": round(hit_rate, 2),
                "total_requests": total_requests,
                "avg_generation_time_ms": round(avg_gen_time * 1000, 2),
                "total_generations": self.generation_count
            }
    
    def clear(self):
        """Clear all cache"""
        with self.lock:
            self.cache.clear()

# Global cache instance
tts_cache = TTSCache(maxsize=1000, ttl=86400)


# Chunk storage for multi-part audio
class ChunkStore:
    """Temporary storage for audio chunks"""
    
    def __init__(self, ttl: int = 600):
        """
        Initialize chunk store
        
        Args:
            ttl: Time-to-live in seconds (default: 10 minutes)
        """
        self.store = TTLCache(maxsize=10000, ttl=ttl)
        self.lock = threading.Lock()
    
    def save_chunks(self, session_id: str, chunks: List[Tuple[str, bytes, str]]) -> List[Dict]:
        """
        Save audio chunks
        
        Args:
            session_id: Unique session identifier
            chunks: List of (chunk_id, audio_bytes, text) tuples
        
        Returns:
            List of chunk metadata
        """
        metadata = []
        
        with self.lock:
            for chunk_id, audio, text in chunks:
                key = f"{session_id}:{chunk_id}"
                self.store[key] = audio
                
                metadata.append({
                    "id": chunk_id,
                    "text": text,
                    "url": f"/api/voice/chunk/{session_id}/{chunk_id}",
                    "size": len(audio)
                })
        
        return metadata
    
    def get_chunk(self, session_id: str, chunk_id: str) -> Optional[bytes]:
        """
        Get audio chunk
        
        Args:
            session_id: Session ID
            chunk_id: Chunk ID
        
        Returns:
            Audio bytes if found, None otherwise
        """
        key = f"{session_id}:{chunk_id}"
        
        with self.lock:
            return self.store.get(key)
    
    def clear_session(self, session_id: str):
        """Clear all chunks for a session"""
        with self.lock:
            keys_to_delete = [k for k in self.store.keys() if k.startswith(f"{session_id}:")]
            for key in keys_to_delete:
                del self.store[key]


# Global chunk store instance
chunk_store = ChunkStore(ttl=600)
