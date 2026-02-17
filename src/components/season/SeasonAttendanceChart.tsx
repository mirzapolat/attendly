import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

export type AttendanceChartType = 'column' | 'line' | 'bubble';

type AttendancePoint = {
  name: string;
  fullName: string;
  attendance: number;
  excused: number;
};

type SeasonAttendanceChartProps = {
  chartType: AttendanceChartType;
  data: AttendancePoint[];
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const SeasonAttendanceChart = ({ chartType, data }: SeasonAttendanceChartProps) => (
  <ResponsiveContainer width="100%" height="100%">
    {chartType === 'column' ? (
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
        />
        <Legend />
        <Bar
          dataKey="attendance"
          name="Attendance"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="excused"
          name="Excused"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ fill: '#f59e0b', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    ) : chartType === 'line' ? (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="attendance"
          name="Attendance"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          dot={{ fill: 'hsl(var(--primary))', r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="excused"
          name="Excused"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ fill: '#f59e0b', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    ) : (
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          type="category"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          dataKey="attendance"
          type="number"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          allowDecimals={false}
        />
        <ZAxis
          dataKey="attendance"
          type="number"
          range={[80, 420]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
        />
        <Legend />
        <Scatter
          name="Attendance"
          data={data}
          fill="hsl(var(--primary))"
          fillOpacity={0.75}
        />
        <Line
          type="monotone"
          dataKey="excused"
          name="Excused"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ fill: '#f59e0b', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    )}
  </ResponsiveContainer>
);

export default SeasonAttendanceChart;
