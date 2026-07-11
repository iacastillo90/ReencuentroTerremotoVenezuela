/**
 * TabMatches.tsx — Coincidencias de IA del usuario
 *
 * PROPÓSITO:
 *   Muestra las coincidencias que la IA ha detectado entre
 *   los reportes del usuario y la base de datos.
 *
 * CADA MATCH MUESTRA:
 *   - Nombre del reporte original (del usuario).
 *   - Score de confianza (%) con color dinámico:
 *     > 90% → verde (alta confianza).
 *     > 80% → amarillo (confianza media).
 *     ≤ 80% → azul (baja confianza, requiere revisión).
 *   - Foto y datos del posible match.
 *   - Botón de acción según la edad:
 *     - Menor de edad (< 18): "Solicitar Mediación" (protección).
 *     - Adulto: "Contactar Institución" (chat directo).
 *
 * NOTA:
 *   Los botones disparan eventos del socket:
 *   handleRequestMediation → 'request_match_chat'.
 *   handleStartDirectChat → 'request_match_chat'.
 *
 *   Ambos son iguales por ahora (el backend maneja la diferencia
 *   según el matchId). Si en el futuro se necesitan lógicas
 *   diferentes, se separan.
 */
import { User, MapPin, Shield, MessageCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface Props {
  myMatches: any[];
  loading: boolean;
  handleRequestMediation: (match: any) => void;
  handleStartDirectChat: (match: any) => void;
}

export function TabMatches({
  myMatches, loading,
  handleRequestMediation, handleStartDirectChat
}: Props) {
  return (
    <div className="profile-content">
      <h3>Sugerencias de la IA ({myMatches.length})</h3>

      {loading ? (
        <div className="profile-loading">Buscando coincidencias...</div>
      ) : myMatches.length === 0 ? (
        <div className="profile-empty">
          <p>Aún no hay coincidencias detectadas para tus reportes.</p>
        </div>
      ) : (
        <div className="my-reports-list">
          {myMatches.map(match => {
            const p = match.matchedPerson;
            if (!p) return null;

            // Determina si es menor de edad para mostrar
            // el botón de mediación en lugar de chat directo.
            const isMinor = p.age !== undefined && p.age < 18;

            // Score de confianza y color dinámico.
            const scorePercent = Math.round(match.score * 100);
            const scoreColor = scorePercent > 90
              ? '#10b981'  // verde
              : scorePercent > 80
              ? '#f59e0b'  // amarillo
              : '#3b82f6'; // azul

            return (
              <div key={match._id}
                className="match-card"
                style={{ borderLeftColor: scoreColor }}>
                {/* Header: nombre del reporte original + score */}
                <div className="match-card-header">
                  <h4>Posible Match para: {match.originalReportName}</h4>
                  <div className="match-card-score"
                    style={{ background: `${scoreColor}20`, color: scoreColor }}>
                    Confiabilidad: {scorePercent}%
                  </div>
                </div>

                {/* Body: foto + info del match */}
                <div className="match-card-body">
                  <div className="match-card-body-inner">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="Foto" className="match-card-photo" />
                    ) : (
                      <div className="match-card-photo-placeholder">
                        <User size={24} />
                      </div>
                    )}
                    <div className="match-card-info">
                      <p className="match-card-name">{p.name}</p>
                      <p className="match-card-desc">
                        {p.lastSeen?.description || p.description}
                      </p>
                      {p.data?.origen && (
                        <p className="match-card-origin">
                          <MapPin size={10} /> Registrado en: {p.data.origen}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer: acción según edad */}
                <div className="match-card-footer">
                  {isMinor ? (
                    <Button variant="outline" size="sm"
                      className="match-card-btn-mediation"
                      onClick={() => handleRequestMediation(match)}>
                      <Shield size={16} /> Solicitar Mediación para Menor
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm"
                      onClick={() => handleStartDirectChat(match)}>
                      <MessageCircle size={16} /> Contactar Institución
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
