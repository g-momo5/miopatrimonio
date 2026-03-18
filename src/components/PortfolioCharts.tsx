import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '../lib/format'
import type { TrendPoint } from '../lib/calculations'

interface PortfolioChartsProps {
  trendData: TrendPoint[]
  allocationData: Array<{ name: string; value: number }>
  institutionData: Array<{ name: string; value: number }>
}

const PIE_COLORS = ['#2f4858', '#33658a', '#86bbd8', '#f6ae2d']

export function PortfolioCharts({
  trendData,
  allocationData,
  institutionData,
}: PortfolioChartsProps) {
  return (
    <section className="grid charts">
      <article className="panel panel-chart">
        <header>
          <h2>Andamento patrimonio</h2>
          <p className="muted">Serie storica da snapshot datati</p>
        </header>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(17, 24, 39, 0.1)" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                name="Totale"
                stroke="#1f2937"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="bank"
                name="Conti"
                stroke="#1d4ed8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="investment"
                name="Investimenti"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel panel-chart">
        <header>
          <h2>Allocazione attivi</h2>
          <p className="muted">Conti vs investimenti</p>
        </header>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={allocationData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={94}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {allocationData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel panel-chart">
        <header>
          <h2>Distribuzione per istituto</h2>
          <p className="muted">Subtotali per banca o broker</p>
        </header>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={institutionData} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(17, 24, 39, 0.1)" />
              <XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <YAxis dataKey="name" type="category" width={140} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="value" fill="#0f766e" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  )
}
