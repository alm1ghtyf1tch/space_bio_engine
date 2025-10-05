import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Paper() {
  const { paperId } = useParams();
  const [paper, setPaper] = useState(null);

  useEffect(() => {
    fetch(`/paper/${paperId}`)
      .then(res => res.json())
      .then(data => setPaper(data));
  }, [paperId]);

  if (!paper) return <div>Loading...</div>;

  return (
    <div>
      <h1>{paper.title}</h1>
      <a href={paper.link} target="_blank">Original Link</a>

      {Object.entries(paper.sections).map(([sectionName, sectionText]) => (
        <div key={sectionName}>
          <h2>{sectionName}</h2>
          <p>{String(sectionText)}</p>
        </div>
      ))}
    </div>
  );
}
