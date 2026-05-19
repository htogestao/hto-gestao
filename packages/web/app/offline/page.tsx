export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-green-950 text-white gap-4 p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-green-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M6.343 17.657a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072"
        />
      </svg>
      <h1 className="text-2xl font-bold">Sem conexão</h1>
      <p className="text-green-300 max-w-xs">
        Você está offline. Conecte-se à internet para acessar o HtoGestão.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  )
}
