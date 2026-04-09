import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


sentiment_analyzer = SentimentIntensityAnalyzer()


def detect_agent_behaviors(chunks_df):
    """
    Detect agent behaviors from chunk_text.
    Rule-based approach for prototype.
    Used AI for this method since I wasn't sure which
    exact behaviors to extrapolate and how to extrapolate them
    """

    behavior_list = []

    for text in chunks_df["chunk_text"]:
        text_lower = text.lower()
        behaviors = []

        # Empathy
        if "i understand" in text_lower or "i can hear" in text_lower:
            behaviors.append("empathy")

        # Explanation
        if "let me explain" in text_lower or "let me walk through" in text_lower:
            behaviors.append("explanation")

        # Assurance
        if "i will make sure" in text_lower or "i will ensure" in text_lower:
            behaviors.append("assurance")

        # Information request
        if "let me verify" in text_lower or "i need to check" in text_lower:
            behaviors.append("information_request")

        # Escalation
        if "supervisor" in text_lower or "escalation" in text_lower:
            behaviors.append("escalation")

        # Process / limitation explanation
        if "usually" in text_lower or "process" in text_lower or "review" in text_lower:
            behaviors.append("process_explanation")

        # Resolution attempt
        if "next steps" in text_lower or "what i can do today" in text_lower:
            behaviors.append("resolution_attempt")

        if not behaviors:
            behaviors.append("neutral")

        behavior_list.append(behaviors)

    chunks_df["behaviors"] = behavior_list

    return chunks_df


def analyze_sentiment(chunks_df):
    """
    Add sentiment scores for each chunk.
    """

    sentiments = []

    for text in chunks_df["chunk_text"]:
        score = sentiment_analyzer.polarity_scores(text)

        sentiments.append({
            "neg": score["neg"],
            "neu": score["neu"],
            "pos": score["pos"],
            "compound": score["compound"]
        })

    sentiment_df = pd.DataFrame(sentiments)

    chunks_df = pd.concat(
        [chunks_df.reset_index(drop=True), sentiment_df],
        axis=1
    )

    return chunks_df


def add_sentiment_label(chunks_df):
    """
    Convert compound score into labels.
    """

    def label(score):
        if score >= 0.2:
            return "positive"
        elif score <= -0.2:
            return "negative"
        else:
            return "neutral"

    chunks_df["sentiment_label"] = chunks_df["compound"].apply(label)

    return chunks_df