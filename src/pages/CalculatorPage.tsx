import ProfitCalculator from '../components/ProfitCalculator.tsx';

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-950">Calculateur de rentabilité</h1>
      <ProfitCalculator />
    </div>
  );
}
