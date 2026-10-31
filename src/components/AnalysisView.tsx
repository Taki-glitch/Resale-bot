import type { AnalysisRow } from '../types.ts';

const show = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));

function Group({ title, tone, entries }: { title: string; tone: string; entries: [string, unknown][] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className={`mb-1 text-sm font-semibold ${tone}`}>{title}</p>
      <ul className="space-y-0.5 text-sm text-slate-700">
        {entries.map(([k, v]) => (
          <li key={k}>
            <span className="text-slate-500">{k} :</span> {show(v)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalysisView({ analysis }: { analysis: AnalysisRow }) {
  const d = analysis.details ?? {};
  const defects = d.condition?.visible_defects ?? [];
  const accessories = d.condition?.accessories ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Confiance de l'IA : <strong>{analysis.confidence == null ? 'inconnue' : `${Math.round(analysis.confidence * 100)} %`}</strong>
        {analysis.model ? ` · modèle ${analysis.model}` : ''}
      </p>
      {!analysis.sufficient_data && (
        <p className="rounded-lg bg-orange-50 p-2 text-sm text-warn">
          Données insuffisantes : l'identification ou l'état restent incertains. Ne te fie pas à cette analyse seule.
        </p>
      )}
      <Group title="Informations certaines" tone="text-gain" entries={Object.entries(analysis.known ?? {})} />
      <Group title="Informations déduites (à vérifier)" tone="text-warn" entries={Object.entries(analysis.inferred ?? {})} />
      {analysis.unknown.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-500">Informations inconnues</p>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {analysis.unknown.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}
      {d.condition?.summary && <p className="text-sm text-slate-700">État apparent : {d.condition.summary}</p>}
      {defects.length > 0 && <p className="text-sm text-loss">Défauts visibles : {defects.join(' ; ')}</p>}
      {accessories.length > 0 && <p className="text-sm text-slate-700">Accessoires : {accessories.join(' ; ')}</p>}
      {d.authenticity_note && (
        <p className="text-sm text-slate-600">
          Authenticité (indications prudentes, aucune authentification possible par photo) : {d.authenticity_note}
        </p>
      )}
      {(d.risk_flags ?? []).length > 0 && <p className="text-sm text-loss">Risques : {(d.risk_flags ?? []).join(' ; ')}</p>}
    </div>
  );
}
