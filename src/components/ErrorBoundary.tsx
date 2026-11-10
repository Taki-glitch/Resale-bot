import { Component } from 'react';
import type { ReactNode } from 'react';

/** Évite l'écran blanc : une erreur d'affichage montre un message clair et un bouton pour recharger. */
export default class ErrorBoundary extends Component<{ children?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="card max-w-md space-y-3">
          <h1 className="text-lg font-semibold text-loss">Une erreur est survenue</h1>
          <p className="text-sm text-slate-600">L'affichage a rencontré un problème. Vos données ne sont pas affectées.</p>
          <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600">{this.state.error.message}</pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Recharger l'application</button>
        </div>
      </div>
    );
  }
}
