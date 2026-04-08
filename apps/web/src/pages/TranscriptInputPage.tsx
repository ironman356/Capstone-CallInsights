import { useState, type FormEvent } from 'react';

type TranscriptResponse = {
  transcript_length: number;
};

const rightPanelSteps = [
  { title: 'Transcript Processing', description: 'Submit a transcript to see the backend result here.' },
  { title: 'Step 2', description: 'Reserved for the next pipeline stage.' },
  { title: 'Step 3', description: 'Reserved for the next pipeline stage.' },
  { title: 'Step 4', description: 'Reserved for the next pipeline stage.' },
  { title: 'Step 5', description: 'Reserved for the next pipeline stage.' },
  { title: 'Step 6', description: 'Reserved for the next pipeline stage.' },
  { title: 'Step 7', description: 'Reserved for the next pipeline stage.' },
];

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export default function TranscriptInputPage() {
  const [transcript, setTranscript] = useState('');
  const [transcriptLength, setTranscriptLength] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/pipeline/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = (await response.json()) as TranscriptResponse;
      setTranscriptLength(data.transcript_length);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to process transcript.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="transcript-page">
      <div className="transcript-layout">
        <form className="transcript-panel transcript-panel--input" onSubmit={handleSubmit}>
          <div className="transcript-panel__header">
            <p className="transcript-kicker">Transcript Input</p>
            <h1>Submit a transcript for processing</h1>
            <p className="transcript-panel__description">
              Paste the transcript on the left, then send it to the backend to see the current pipeline output.
            </p>
          </div>

          <label className="transcript-field" htmlFor="transcript-input">
            <span className="transcript-field__label">Transcript text</span>
            <textarea
              id="transcript-input"
              className="transcript-textarea"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Paste the transcript here..."
              rows={18}
            />
          </label>

          <div className="transcript-actions">
            <button className="transcript-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Process'}
            </button>
          </div>
        </form>

        <aside className="transcript-panel transcript-panel--steps">
          {rightPanelSteps.map((step, index) => (
            <section key={step.title} className="transcript-step-card">
              <p className="transcript-step-card__title">{step.title}</p>
              <p className="transcript-step-card__description">{step.description}</p>

              {index === 0 ? (
                <div className="transcript-result" aria-live="polite">
                  {error ? (
                    <span className="transcript-result__error">{error}</span>
                  ) : transcriptLength !== null ? (
                    <span>
                      Backend response: transcript length is <strong>{transcriptLength}</strong>
                    </span>
                  ) : (
                    <span>Waiting for submission.</span>
                  )}
                </div>
              ) : null}
            </section>
          ))}
        </aside>
      </div>
    </section>
  );
}
