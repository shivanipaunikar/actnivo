const steps = ["Upload", "Map columns", "Validate", "Map SKUs", "Import", "Complete"];

export function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="import-steps" aria-label="Import progress">
      {steps.map((step, index) => (
        <li key={step} className={index + 1 < current ? "done" : index + 1 === current ? "active" : ""}>
          <span>{index + 1 < current ? "✓" : index + 1}</span>
          <small>{step}</small>
        </li>
      ))}
    </ol>
  );
}
