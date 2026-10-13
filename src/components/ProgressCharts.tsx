"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const common = { stroke: "#dce8e3" };
export function WeeklyChart({ data }: { data: { week: string; sessions: number }[] }) {
  return (
    <div className="h-48"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -24, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} {...common} />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#5d726c" }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5d726c" }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "#d5efe7" }} />
        <Bar dataKey="sessions" fill="#188978" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer></div>
  );
}
export function TrendChart({ data, unit }: { data: { date: string; load: number | null; e1rm: number | null }[]; unit: string }) {
  return (
    <div className="h-56"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} {...common} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#5d726c" }} tickLine={false} axisLine={false} />
        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#5d726c" }} tickLine={false} axisLine={false} unit={` ${unit}`} width={56} />
        <Tooltip />
        <Line type="monotone" dataKey="load" name="Heaviest" stroke="#188978" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="e1rm" name="Est. 1RM" stroke="#17302d" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer></div>
  );
}
