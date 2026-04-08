import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from DataPreProcessing import *

def prepare_chunks(files):
    """
    Clean way to prepare the chunks required
    for the embedding and other NLP layer functions.
    """
    data = load_data(files)
    data = clean_data(data)
    data = normalize_text(data)
    chunks = chunk_transcripts(data)

    return chunks

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


def generate_embeddings(chunks_df):
    """
    Convert chunk_text into vector embeddings.
    We are using the sentenceTransformer library as of now,
    this is variable to change.
    """

    texts = chunks_df["chunk_text"].tolist()

    embeddings = embedding_model.encode(
        texts,
        show_progress_bar=False
    )

    chunks_df["embedding"] = list(embeddings)

    return chunks_df


def cluster_chunks(chunks_df, n_clusters=8):
    """
    Group similar chunks using embeddings.
    """

    embeddings = np.vstack(chunks_df["embedding"].values)

    model = KMeans(
        n_clusters=n_clusters,
        random_state=42,
        n_init=10
    )

    clusters = model.fit_predict(embeddings)

    chunks_df["cluster_id"] = clusters

    return chunks_df, model

def label_issues_from_clusters(chunks_df):
    """
    Convert cluster IDs into human-readable issue labels.
    We are currently choosing issue labels based on
    the top 3 most common words
    """

    issue_labels = {}

    for cluster_id in chunks_df["cluster_id"].unique():
        cluster_data = chunks_df[chunks_df["cluster_id"] == cluster_id]

        # Simple heuristic: use most common words
        all_text = " ".join(cluster_data["chunk_text"].tolist())
        words = all_text.split()

        # Get top frequent words
        word_freq = {}
        for w in words:
            word_freq[w] = word_freq.get(w, 0) + 1

        top_words = sorted(word_freq, key=word_freq.get, reverse=True)[:3]

        # Create placeholder label
        label = " / ".join(top_words) if top_words else f"Issue_{cluster_id}"

        issue_labels[cluster_id] = label

    # Map back to dataframe
    chunks_df["issue_label"] = chunks_df["cluster_id"].map(issue_labels)

    return chunks_df, issue_labels

def run_issue_detection_pipeline(chunks_df):
    """
    End-to-end issue detection:
    1. Generate embeddings
    2. Cluster chunks
    3. Label clusters as issues
    """

    # Embeddings
    chunks_df = generate_embeddings(chunks_df)

    # Clustering
    chunks_df, cluster_model = cluster_chunks(chunks_df)

    # Issue labeling
    chunks_df, issue_map = label_issues_from_clusters(chunks_df)

    return chunks_df, cluster_model, issue_map
