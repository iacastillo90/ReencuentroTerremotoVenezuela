import React from 'react';

interface HomeActionCardProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  style?: React.CSSProperties;
}

export const HomeActionCard: React.FC<HomeActionCardProps> = ({ icon, title, onClick, style }) => {
  return (
    <>
      <style>{`
        .home-action-card:active {
          background: var(--BTN-Primary-Bg, #4497D6) !important;
        }
      `}</style>
      <button
        className="home-action-card"
        onClick={onClick}
        style={{
          width: '100%',
          maxWidth: '358px',
          height: '51px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          borderRadius: '50px',
          border: '1px solid transparent',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 500,
          color: '#fff',
          margin: '0 auto',
          transition: 'filter 0.2s, background 0.1s',
          whiteSpace: 'nowrap',
          ...style
        }}
        onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
        onMouseOut={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
      >
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>{icon}</div>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      </button>
    </>
  );
};
