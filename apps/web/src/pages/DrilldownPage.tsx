import type { CallCard, CallDetail } from "../types";
import { titleCase } from "../utils";

interface DrilldownPageProps {
  callDetail: CallDetail | null;
  calls: CallCard[];
  selectedCallId: string | null;
  onSelectCall: (callId: string) => void;
}

export function DrilldownPage({ callDetail, calls, selectedCallId, onSelectCall }: DrilldownPageProps) {
  return (
    <section className="drilldown-grid">
      <article className="panel transcript-panel">
        <div className="drilldown-header">
          <div className="section-heading">
            <h2>Call Drilldown</h2>
            <p>{callDetail ? `${callDetail.call_id} from ${callDetail.source_file}` : "Select a call to inspect."}</p>
          </div>
          <label className="call-selector">
            <select
              className="input call-selector-input"
              value={selectedCallId ?? ""}
              onChange={(event) => onSelectCall(event.target.value)}
            >
              {calls.map((call) => (
                <option key={call.call_id} value={call.call_id}>
                  {call.call_id} - {titleCase(call.issue)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="transcript-stream">
          {callDetail?.turns.map((turn, index) => (
            <div className={`turn ${turn.speaker.toLowerCase()}`} key={`${turn.speaker}-${index}`}>
              <span>{turn.speaker}</span>
              <p>{turn.text}</p>
            </div>
          ))}
        </div>
      </article>

      <aside className="panel">
        <div className="section-heading">
          <h2>Structured extraction</h2>
          <p>{callDetail?.summary ?? "Behavior, sentiment, and segment evidence lives here."}</p>
        </div>
        <div className="detail-stack">
          <article className="mini-panel">
            <h3>Sentiment timeline</h3>
            {callDetail
              ? Object.entries(callDetail.sentiments).map(([key, value]) => (
                  <div className="line-item" key={key}>
                    <span>{titleCase(key)}</span>
                    <strong>{Number(value).toFixed(3)}</strong>
                  </div>
                ))
              : null}
          </article>
          <article className="mini-panel">
            <h3>Behavior signals</h3>
            <div className="tag-row">
              {callDetail?.behaviors.map((behavior) => (
                <span className="tag" key={behavior}>
                  {behavior}
                </span>
              ))}
            </div>
          </article>
          <article className="mini-panel">
            <h3>Segments</h3>
            <div className="segment-stack">
              {callDetail?.segments.map((segment) => (
                <div className="segment-card" key={segment.segment_id}>
                  <div className="line-item">
                    <span>Segment {segment.order}</span>
                    <strong>{titleCase(segment.issue)}</strong>
                  </div>
                  <p>{segment.turn_count} turns</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </aside>
    </section>
  );
}
