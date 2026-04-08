import numpy as np
import pandas as pd
import re

def load_data(files):
    """
    Method for loading the data files, since we currently do not have data,
    fill this method once we do get the data
    """
    data = None
    return data

def clean_data(data):
    """
    This method is for cleaning the data if required, fill this method
    once we do get the data
    """
    cleaned_data = None
    return cleaned_data

def normalize_text(cleaned_data):
    def normalize(text):
        if not isinstance(text, str):
            return ""
        text = text.lower()
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"[^\w\s.,!?]", "", text)
        text = re.sub(r"([!?.,])\1+", r"\1", text)
        return text.strip()

    cleaned_data["cleaned_transcript"] = cleaned_data["transcript"].apply(normalize)
    return cleaned_data


def chunk_text(text, chunk_size=100, overlap=25):
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    words = text.split()
    chunks = []

    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = words[start:end]
        chunks.append(" ".join(chunk))
        start += (chunk_size - overlap)

    return chunks


def chunk_transcripts(data):
    records = []

    for _, row in data.iterrows():
        call_id = row["call_id"]
        text = row.get("cleaned_transcript", "")

        if not text:
            continue

        chunks = chunk_text(text)

        for i, chunk in enumerate(chunks):
            records.append({
                "call_id": call_id,
                "chunk_id": f"{call_id}_{i}",
                "chunk_index": i,
                "chunk_text": chunk
            })

    return pd.DataFrame(records)

