"""
Text Normalizer for TTS
Cleans and prepares text for high-quality voice synthesis
"""
import re
from typing import Tuple, List

def normalize_for_tts(text: str, language: str = "English") -> str:
    """
    Normalize text for TTS to prevent robotic/broken voice
    
    Args:
        text: Raw text from AI
        language: "English" or "Bengali"
    
    Returns:
        Clean, voice-friendly text
    """
    if not text or not text.strip():
        return ""
    
    # Trim whitespace
    text = text.strip()
    
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    
    # Replace multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove markdown formatting (bold, italic, code blocks)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*(.+?)\*', r'\1', text)      # *italic*
    text = re.sub(r'`(.+?)`', r'\1', text)        # `code`
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)  # code blocks
    
   # Handle Bengali-specific
    if language.lower() in ["bengali", "bangla", "bn"]:
        # Ensure Bengali punctuation
        # Add দাঁড়ি (।) if sentence doesn't end with proper punctuation
        sentences = text.split('\n')
        normalized_sentences = []
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # If doesn't end with punctuation, add দাঁড়ি
            if sentence and not re.search(r'[।?.!]$', sentence):
                sentence += '।'
            
            # Limit sentence length (insert দাঁড়ি if too long)
            if len(sentence) > 180:
                # Try to break at natural pause points
                parts = re.split(r'(,|এবং|কিন্তু|তবে)', sentence)
                rebuilt = ""
                for part in parts:
                    if len(rebuilt) + len(part) > 160:
                        if rebuilt:
                            normalized_sentences.append(rebuilt.strip() + '।')
                            rebuilt = part
                    else:
                        rebuilt += part
                if rebuilt:
                    normalized_sentences.append(rebuilt.strip() + '।')
            else:
                normalized_sentences.append(sentence)
        
        text = ' '.join(normalized_sentences)
    
    else:
        # English normalization
        # Ensure proper punctuation
        if text and not re.search(r'[.?!]$', text):
            text += '.'
        
        # Limit sentence length
        sentences = re.split(r'([.?!])\s+', text)
        normalized_sentences = []
        current = ""
        
        for i, part in enumerate(sentences):
            if i % 2 == 0:  # Text part
                current += part
            else:  # Punctuation
                current += part
                if len(current) > 180:
                    # Break long sentence at commas
                    if ',' in current:
                        parts = current.split(',')
                        for j, p in enumerate(parts[:-1]):
                            normalized_sentences.append(p.strip() + '.')
                        current = parts[-1].strip()
                
                if current.strip():
                    normalized_sentences.append(current.strip())
                current = ""
        
        if current.strip():
            normalized_sentences.append(current.strip())
        
        text = ' '.join(normalized_sentences)
    
    # Convert bullet points to sentences
    text = re.sub(r'^\s*[-•*]\s+', '', text, flags=re.MULTILINE)
    
    # Final cleanup
    text = ' '.join(text.split())  # Normalize all whitespace
    
    return text


def extract_voice_summary(text: str, max_chars: int = 600) -> Tuple[str, str]:
    """
    Extract a voice-friendly summary from longer text
    
    Args:
        text: Full text response
        max_chars: Maximum characters for voice
    
    Returns:
        (voice_text, caption_text) tuple
    """
    if len(text) <= max_chars:
        return text, text
    
    # Split into sentences
    sentences = re.split(r'([।.?!])\s+', text)
    
    voice_sentences = []
    voice_length = 0
    caption_text = text
    
    for i in range(0, len(sentences), 2):
        if i + 1 < len(sentences):
            sentence = sentences[i] + sentences[i + 1]
        else:
            sentence = sentences[i]
        
        if voice_length + len(sentence) <= max_chars:
            voice_sentences.append(sentence.strip())
            voice_length += len(sentence)
        else:
            break
    
    voice_text = ' '.join(voice_sentences)
    
    # If we cut off too early, add an ellipsis
    if voice_length < len(text) * 0.5:
        if text.endswith('।'):
            voice_text += ' আরো বিস্তারিত নিচে দেখুন।'
        else:
            voice_text += ' See below for more details.'
    
    return voice_text, caption_text
