import ReactMarkdown from "react-markdown";

function StructuredResponse({ data }) {
  if (!data) return null;

  return (
    <div className="bubble">
      <h3>🧠 Condition Overview</h3>
      <ReactMarkdown>{data.condition_overview}</ReactMarkdown>

      <h3>📚 Research Insights</h3>
      <ReactMarkdown>{data.research_insights}</ReactMarkdown>

      <h3>🧪 Clinical Trials</h3>
      <ReactMarkdown>{data.clinical_trials_summary}</ReactMarkdown>

      <h3>💡 Recommendations</h3>
      <ReactMarkdown>{data.recommendations}</ReactMarkdown>

      <p style={{ opacity: 0.6 }}>⚠ {data.disclaimer}</p>
    </div>
  );
}

export default StructuredResponse;