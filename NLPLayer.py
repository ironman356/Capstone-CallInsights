import numpy as np
import pandas as pd
from DataPreProcessing import *

files = None

data = load_data(files)
cleaned_data = clean_data(data)
normalized_data = normalize_text(cleaned_data)
chunked_transcripts = chunk_transcripts(normalized_data)
