interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'emerald' | 'violet' | 'amber';
}

const colorMap = {
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
  violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/20',
  amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
};

const valueColorMap = {
  blue: 'text-blue-400',
  emerald: 'text-emerald-400',
  violet: 'text-violet-400',
  amber: 'text-amber-400',
};

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = 'blue',
}: StatCardProps) {
  return (
    <div
      className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-5 transition-transform hover:scale-[1.02]`}
    >
      <p className="text-sm text-slate-400 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${valueColorMap[color]}`}>{value}</p>
      <div className="flex items-center gap-2 mt-2">
        {trend && trendValue && (
          <span
            className={`text-xs font-medium ${
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
    </div>
  );
}
