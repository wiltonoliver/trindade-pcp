import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Página não encontrada</h2>
      <p className="text-slate-500 mb-6 text-sm">A página procurada não existe ou foi movida.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors"
      >
        Voltar ao Início
      </Link>
    </div>
  );
}
