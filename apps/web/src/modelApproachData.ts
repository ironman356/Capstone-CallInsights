export type ModelFamily = "Hybrid" | "Supervised ML" | "Semantic ML" | "Rules" | "Legacy";

export type ModelApproach = {
  id: string;
  name: string;
  family: ModelFamily;
  macroF1: number;
  accuracy: number;
  paraphrase: number | null;
  confound: number | null;
  multiIssue: number;
  runtimeSeconds: number | null;
  summary: string;
  tradeoff: string;
};

export const benchmarkSummary = {
  calls: 144,
  segments: 240,
  testCalls: 28,
  testSegments: 46,
  topics: 6,
};

export const modelApproaches: ModelApproach[] = [
  {
    id: "hybrid-llm-ml",
    name: "Hybrid LLM + ML",
    family: "Hybrid",
    macroF1: 1,
    accuracy: 1,
    paraphrase: null,
    confound: null,
    multiIssue: 1,
    runtimeSeconds: null,
    summary: "LLM segments each call, embeddings retrieve approved topics, and an LLM reranks with transcript evidence.",
    tradeoff: "Best synthetic accuracy and evidence quality; requires an approved model endpoint and SPS validation.",
  },
  {
    id: "taxonomy-rules",
    name: "Taxonomy keyword rules",
    family: "Rules",
    macroF1: 0.8295,
    accuracy: 0.8478,
    paraphrase: 0.7742,
    confound: 0.9774,
    multiIssue: 0.7143,
    runtimeSeconds: 0.0042,
    summary: "Scores curated mortgage terms against a fixed six-topic taxonomy.",
    tradeoff: "Fast and explainable, but coverage depends on manually maintained vocabulary.",
  },
  {
    id: "char-word-logistic",
    name: "Character + word TF-IDF",
    family: "Supervised ML",
    macroF1: 0.6402,
    accuracy: 0.6087,
    paraphrase: 0.4387,
    confound: 0.9266,
    multiIssue: 0.4286,
    runtimeSeconds: 0.1022,
    summary: "Combines character and word n-grams with balanced logistic regression.",
    tradeoff: "Solid conventional baseline, but lexical variation still reduces recall.",
  },
  {
    id: "char-svm",
    name: "Character TF-IDF + SVM",
    family: "Supervised ML",
    macroF1: 0.6206,
    accuracy: 0.6087,
    paraphrase: 0.4968,
    confound: 0.9605,
    multiIssue: 0.3571,
    runtimeSeconds: 0.0553,
    summary: "Uses character n-grams and a class-balanced linear support-vector classifier.",
    tradeoff: "Handles spelling and ASR variation well; multi-issue exact matching remains weak.",
  },
  {
    id: "word-ridge",
    name: "Word TF-IDF + Ridge",
    family: "Supervised ML",
    macroF1: 0.6006,
    accuracy: 0.5652,
    paraphrase: 0.3677,
    confound: 0.9153,
    multiIssue: 0.4286,
    runtimeSeconds: 0.0946,
    summary: "Classifies word uni-, bi-, and trigrams with regularized linear scoring.",
    tradeoff: "Stable and simple, but less robust to paraphrases than character models.",
  },
  {
    id: "lsa-logistic",
    name: "LSA semantic linear",
    family: "Semantic ML",
    macroF1: 0.5746,
    accuracy: 0.5435,
    paraphrase: 0.3484,
    confound: 0.9153,
    multiIssue: 0.4286,
    runtimeSeconds: 0.0685,
    summary: "Compresses TF-IDF into latent semantic dimensions before logistic classification.",
    tradeoff: "Adds semantic smoothing, but compression loses topic-specific detail on this dataset.",
  },
  {
    id: "word-centroid",
    name: "Word TF-IDF centroid",
    family: "Semantic ML",
    macroF1: 0.5533,
    accuracy: 0.5435,
    paraphrase: 0.3871,
    confound: 0.8983,
    multiIssue: 0.3571,
    runtimeSeconds: 0.0196,
    summary: "Maps each segment to the nearest average TF-IDF vector for a topic.",
    tradeoff: "Cheap retrieval baseline; averages blur closely related issue language.",
  },
  {
    id: "complement-nb",
    name: "TF-IDF + Complement NB",
    family: "Supervised ML",
    macroF1: 0.5029,
    accuracy: 0.4783,
    paraphrase: 0.3419,
    confound: 0.904,
    multiIssue: 0.3571,
    runtimeSeconds: 0.0136,
    summary: "Uses a Naive Bayes variant designed for imbalanced text classes.",
    tradeoff: "Very fast, but its token-independence assumption limits nuanced topic separation.",
  },
  {
    id: "char-sgd",
    name: "Character TF-IDF + SGD",
    family: "Supervised ML",
    macroF1: 0.4288,
    accuracy: 0.5,
    paraphrase: 0.5613,
    confound: 0.8418,
    multiIssue: 0.2857,
    runtimeSeconds: 0.0395,
    summary: "Learns a scalable modified-Huber classifier over character n-grams.",
    tradeoff: "Good incremental-training candidate, but less accurate on the frozen test split.",
  },
  {
    id: "legacy-keyphrases",
    name: "Current keyphrase pipeline",
    family: "Legacy",
    macroF1: 0,
    accuracy: 0,
    paraphrase: 0.1161,
    confound: 1,
    multiIssue: 0,
    runtimeSeconds: 0.0065,
    summary: "Applies the existing free-form issue labels and keyword matching logic.",
    tradeoff: "Fast, but its output labels do not align to the benchmark taxonomy.",
  },
];

export const approachExtractionResults = [
  { name: "Character TF-IDF + SVM", macroF1: 0.7594, accuracy: 0.8043 },
  { name: "Character + word TF-IDF", macroF1: 0.6969, accuracy: 0.7391 },
  { name: "Character TF-IDF + SGD", macroF1: 0.582, accuracy: 0.6739 },
  { name: "Word TF-IDF + Ridge", macroF1: 0.5473, accuracy: 0.6087 },
  { name: "LSA semantic linear", macroF1: 0.5318, accuracy: 0.6087 },
  { name: "Word TF-IDF centroid", macroF1: 0.5073, accuracy: 0.5217 },
  { name: "TF-IDF + Complement NB", macroF1: 0.4636, accuracy: 0.5435 },
  { name: "Taxonomy keyword rules", macroF1: 0.0288, accuracy: 0.1304 },
];
