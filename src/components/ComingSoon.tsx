export default function ComingSoon({ title, version, text }: { title: string; version: string; text: string }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-navy-950">{title}</h1>
      <div className="card">
        <p className="mb-1 font-medium">Disponible en {version}</p>
        <p className="text-sm text-slate-600">{text}</p>
      </div>
    </div>
  );
}
