"""
Sentence Splitter for TTS
Smart sentence splitting for smooth sequential audio playback
"""
import re
from typing import List


def split_into_sentences(text: str, language: str = "English", max_sentences: int = 12) -> List[str]:
    """
    Split text into sentences for TTS chunking
    
    Args:
        text: Normalized text
        language: "English" or "Bengali"
        max_sentences: Maximum number of sentences to return
    
    Returns:
        List of sentences ready for TTS
    """
    if not text or not text.strip():
        return []
    
    sentences = []
    
    if language.lower() in ["bengali", "bangla", "bn"]:
        # Bengali sentence splitting
        # Split on দাঁড়ি (।), question mark (?), exclamation (!)
        parts = re.split(r'([।?!])', text)
        
        current_sentence = ""
        for i, part in enumerate(parts):
            if i % 2 == 0:  # Text part
                current_sentence += part.strip()
            else:  # Punctuation
                current_sentence += part
                if current_sentence.strip():
                    sentences.append(current_sentence.strip())
                current_sentence = ""
        
        # Add remaining if any
        if current_sentence.strip():
            sentences.append(current_sentence.strip())
    
    else:
        # English sentence splitting
        # Split on period, question mark, exclamation
        parts = re.split(r'([.?!])\s+', text)
        
        current_sentence = ""
        for i, part in enumerate(parts):
            if i % 2 == 0:  # Text part
                current_sentence += part.strip()
            else:  # Punctuation
                current_sentence += part + " "
                if current_sentence.strip():
                    sentences.append(current_sentence.strip())
                current_sentence = ""
        
        # Add remaining if any
        if current_sentence.strip():
            sentences.append(current_sentence.strip())
    
    # Filter out very short fragments and merge them
    merged_sentences = []
    pending = ""
    
    for sentence in sentences:
        # Merge very short fragments (< 8 chars) with previous
        if len(sentence) < 8 and merged_sentences:
            merged_sentences[-1] += " " + sentence
        elif pending:
            merged_sentences.append(pending + " " + sentence)
            pending = ""
        else:
            if len(sentence) < 8:
                pending = sentence
            else:
                merged_sentences.append(sentence)
    
    # Add any pending
    if pending and merged_sentences:
        merged_sentences[-1] += " " + pending
    elif pending:
        merged_sentences.append(pending)
    
    # Limit to max sentences
    if len(merged_sentences) > max_sentences:
        # Keep first sentences and add ellipsis
        merged_sentences = merged_sentences[:max_sentences]
        last_sentence = merged_sentences[-1]
        if language.lower() in ["bengali", "bangla", "bn"]:
            # Don't add ellipsis if already has punctuation
            if not last_sentence.endswith('।'):
                merged_sentences[-1] = last_sentence + '।'
        else:
            if not last_sentence.endswith('.'):
                merged_sentences[-1] = last_sentence + '.'
    
    return merged_sentences


def format_for_doctor_tone(sentences: List[str], language: str = "English") -> List[str]:
    """
    Format sentences for calm, professional doctor tone
    
    Args:
        sentences: List of sentences
        language: "English" or "Bengali"
    
    Returns:
        Formatted sentences with doctor tone
    """
    if not sentences:
        return []
    
    # Add disclaimer at the end if not present
    if language.lower() in ["bengali", "bangla", "bn"]:
        disclaimer = "মনে রাখবেন, এটি শুধুমাত্র তথ্যমূলক। কোনো সমস্যা হলে ডাক্তারের পরামর্শ নিন।"
        # Check if disclaimer already present
        has_disclaimer = any(disclaimer[:20] in s for s in sentences)
        if not has_disclaimer:
            sentences.append(disclaimer)
    else:
        disclaimer = "Remember, this is for informational purposes only. Please consult a doctor if needed."
        has_disclaimer = any("informational purposes" in s.lower() for s in sentences)
        if not has_disclaimer:
            sentences.append(disclaimer)
    
    return sentences
