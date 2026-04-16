import numpy as np
import pandas as pd
import re
import os

def load_data(files):
    """
    Method for loading the data files
    """
    records = []

    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()

            filename = os.path.basename(file_path)
            call_id_match = re.findall(r"\d+", filename)
            call_id = call_id_match[0] if call_id_match else filename

            records.append({
                "call_id": call_id,
                "transcript": text
            })

        except Exception as e:
            print(f"Error loading {file_path}: {e}")

    data = pd.DataFrame(records)
    return data


def clean_data(data):
    """
    This method is for cleaning the data if required
    """
    def clean_transcript(text):
        if not isinstance(text, str):
            return ""

        text = text.replace("\r", "\n")
        text = re.sub(r"\n+", "\n", text)

        text = re.sub(r"Agent:", "agent:", text)
        text = re.sub(r"Customer:", "customer:", text)

        lines = [line.strip() for line in text.split("\n") if line.strip()]

        return " ".join(lines)

    data["transcript"] = data["transcript"].apply(clean_transcript)

    cleaned_data = data
    return cleaned_data


def normalize_text(cleaned_data):
    """
    This method is used to make sure that capitalization, etc. does not
    interfere or cause weird behaviors.
    """
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
    """
    Helper method for the chunk_transcripts method where the huge calls are
    being transformed into smaller usable chunks, the chunk length
    and other parameter are subject to variability.
    """
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
    """
    Driver method to chunk the actual normalized dataset
    """
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