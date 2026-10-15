/** Local vector flags also render correctly on Windows without emoji flag support. */
export function MarketFlag({ code }: { code: string }): React.JSX.Element {
  const union = (
    <>
      <path fill="#012169" d="M0 0h60v40H0z" />
      <path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40" />
      <path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M60 0 0 40" />
      <path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60" />
      <path stroke="#c8102e" strokeWidth="8" d="M30 0v40M0 20h60" />
    </>
  );
  const star =
    '0,-7 1.7,-2.4 6.7,-2.2 2.8,0.9 4.1,5.7 0,3 -4.1,5.7 -2.8,0.9 -6.7,-2.2 -1.7,-2.4';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 40"
      className="h-8 w-12 shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-black/10"
    >
      <rect width="60" height="40" fill="#fff" />
      {code === 'GB' && union}
      {code === 'TH' && (
        <>
          <path fill="#a51931" d="M0 0h60v40H0z" />
          <path fill="#f4f5f8" d="M0 7h60v26H0z" />
          <path fill="#2d2a4a" d="M0 13h60v14H0z" />
        </>
      )}
      {code === 'DE' && (
        <>
          <path fill="#111" d="M0 0h60v14H0z" />
          <path fill="#d00" d="M0 13h60v14H0z" />
          <path fill="#ffce00" d="M0 27h60v13H0z" />
        </>
      )}
      {code === 'AE' && (
        <>
          <path fill="#00843d" d="M0 0h60v13H0z" />
          <path fill="#111" d="M0 27h60v13H0z" />
          <path fill="#ef3340" d="M0 0h15v40H0z" />
        </>
      )}
      {code === 'JP' && <circle cx="30" cy="20" r="12" fill="#bc002d" />}
      {code === 'IN' && (
        <>
          <path fill="#ff9933" d="M0 0h60v13H0z" />
          <path fill="#138808" d="M0 27h60v13H0z" />
          <circle cx="30" cy="20" r="5.5" fill="none" stroke="#000080" />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              stroke="#000080"
              strokeWidth=".45"
              d="M30 14.5v11"
              transform={`rotate(${i * 15} 30 20)`}
            />
          ))}
        </>
      )}
      {code === 'CH' && (
        <>
          <path fill="#da291c" d="M0 0h60v40H0z" />
          <path fill="#fff" d="M25 7h10v26H25zM17 15h26v10H17z" />
        </>
      )}
      {code === 'TR' && (
        <>
          <path fill="#e30a17" d="M0 0h60v40H0z" />
          <circle cx="24" cy="20" r="12" fill="#fff" />
          <circle cx="28" cy="18" r="10" fill="#e30a17" />
          <polygon
            points={star}
            fill="#fff"
            transform="translate(40 19) rotate(18)"
          />
        </>
      )}
      {code === 'HK' && (
        <>
          <path fill="#de2910" d="M0 0h60v40H0z" />
          {Array.from({ length: 5 }, (_, i) => (
            <path
              key={i}
              fill="#fff"
              d="M30 20c-9-4-6-14 0-13 6 1 7 8 0 13"
              transform={`rotate(${i * 72} 30 20)`}
            />
          ))}
        </>
      )}
      {code === 'AU' && (
        <>
          <path fill="#012169" d="M0 0h60v40H0z" />
          <svg width="30" height="20" viewBox="0 0 60 40">
            {union}
          </svg>
          {[
            [16, 30, 0.6],
            [44, 8, 0.4],
            [39, 22, 0.4],
            [53, 19, 0.4],
            [46, 33, 0.4],
          ].map(([x, y, s], i) => (
            <polygon
              key={i}
              points={star}
              fill="#fff"
              transform={`translate(${x} ${y}) scale(${s})`}
            />
          ))}
        </>
      )}
    </svg>
  );
}
