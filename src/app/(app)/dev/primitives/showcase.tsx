import { BurnChart } from "@/components/charts/burn-chart";
import { DayBars } from "@/components/charts/day-bars";
import { HeatTable } from "@/components/charts/heat-table";
import { MonthBars } from "@/components/charts/month-bars";
import { Sparkline } from "@/components/charts/sparkline";
import { RowSelection } from "@/components/shell/row-selection";
import { DataTable, ShareBar, Swatch, Token } from "@/components/ui/data-table";
import { FilterBar, FilterGroup, FilterToken } from "@/components/ui/filter-token";
import { Flag } from "@/components/ui/flag";
import { Kbd } from "@/components/ui/kbd";
import { Kpi, KpiStrip } from "@/components/ui/kpi-strip";
import { Delta, Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import {
  EmptyState,
  ErrorState,
  SkeletonBlock,
  SkeletonLines,
} from "@/components/ui/states";
import { SEARCH_FIELD_ATTRIBUTE } from "@/lib/keyboard";
import { formatMoney, formatPercent } from "@/lib/money";
import {
  CATEGORIES,
  CUMULATIVE,
  DAY_LIMIT,
  HEAT_MONTHS,
  HEAT_ROWS,
  LABELS,
  MONTH,
  MONTHLY,
  RECENT,
  type SampleCategory,
  type SampleLabel,
  type SampleSource,
  type SampleTransaction,
  SOURCES,
} from "./sample-data";
import { PanelGrid, Specimen } from "./specimen";

const biggestLabel = LABELS[0]?.total ?? 1;

export function Showcase() {
  return (
    <>
      <Specimen title="Type scale" note="11 / 11.5 / 12 / 12.5 / 13 / 15 / 16 / 20">
        <Panel>
          <p className="text-title">20 Page title, sentence case</p>
          <p className="text-section font-semibold">15 Section heading</p>
          <p className="text-body">13 Body text, the default</p>
          <p className="tnum text-figure">12.5 Figures ₱81,578.35 in IBM Plex Mono</p>
          <p className="text-head font-semibold">12 Panel header</p>
          <p className="text-meta text-muted">11.5 Table header and KPI label</p>
          <p className="text-label text-muted">11 Small print and sidebar group labels</p>
        </Panel>
      </Specimen>

      <Specimen title="Colour tokens">
        <Panel flush>
          <div className="grid grid-cols-2 gap-px bg-rule-2 wide:grid-cols-4">
            {(
              [
                ["bg", "bg-bg"],
                ["panel", "bg-panel"],
                ["rule", "bg-rule"],
                ["rule-2", "bg-rule-2"],
                ["ink", "bg-ink"],
                ["muted", "bg-muted"],
                ["accent", "bg-accent"],
                ["accent-soft", "bg-accent-soft"],
                ["income", "bg-income"],
                ["expense", "bg-expense"],
                ["warn-bg", "bg-warn-bg"],
                ["sk", "bg-sk"],
              ] as const
            ).map(([name, background]) => (
              <div key={name} className="flex items-center gap-2 bg-panel px-2.5 py-2">
                <span className={`inline-block size-5 rounded-chip border border-rule ${background}`} />
                <span className="text-label text-muted">{name}</span>
              </div>
            ))}
          </div>
        </Panel>
      </Specimen>

      <Specimen title="Flag, KPI strip and sparklines">
        <Flag>
          Over budget by <Money value={MONTH.remaining * -1} bare className="font-medium" /> since{" "}
          {MONTH.short} {MONTH.overFromDay}. Projected month end{" "}
          <Money value={MONTH.projected} bare dp={0} className="font-medium" /> (
          {formatPercent(MONTH.projected / MONTH.budget - 1)} over).
        </Flag>

        <KpiStrip>
          <Kpi
            label="Income"
            value={<Money value={MONTH.income} tone="income" bare />}
            chart={<Sparkline values={[71_200, 0, 83_100, 76_400, 88_300, 79_954]} color="var(--income)" />}
          />
          <Kpi
            label="Spent"
            value={<Money value={MONTH.spent} bare />}
            chart={<Sparkline values={[68_400, 0, 79_900, 71_250, 95_314, 81_578]} color="var(--expense)" />}
            note={`▼ ${formatMoney(Math.abs(MONTH.vsPrevious), { dp: 0, symbol: "" })} vs ${MONTH.previousLabel}`}
          />
          <Kpi label="Budget" value={<Money value={MONTH.budget} bare dp={0} />} note="5-mo avg, no plan saved" />
          <Kpi
            label="Remaining"
            value={<Money value={MONTH.remaining} tone="expense" bare />}
            note={`${formatPercent(MONTH.spent / MONTH.budget)} used, day ${MONTH.lastDay}/${MONTH.daysInMonth}`}
          />
          <Kpi
            label="Burn / day"
            value={<Money value={MONTH.burnPerDay} bare dp={0} />}
            note={`pace ${formatMoney(MONTH.pace, { dp: 0, symbol: "" })}`}
          />
          <Kpi
            label="Net"
            value={<Money value={MONTH.net} tone="expense" bare sign />}
            chart={<Sparkline values={[2_800, 0, 3_200, 5_150, 0, 0]} color="var(--accent)" />}
          />
        </KpiStrip>
      </Specimen>

      <Specimen title="Burn chart, day bars and a flush table">
        <PanelGrid columns="a">
          <Panel title="Cumulative spend vs budget" meta="dashed = budget, dotted = pace">
            <BurnChart cumulative={CUMULATIVE} budget={MONTH.budget} />
            <div className="mt-2">
              <DayBars cumulative={CUMULATIVE} limit={DAY_LIMIT} />
            </div>
            <div className="flex justify-between text-label text-muted">
              <span className="tnum">01</span>
              <span>daily spend, red = over 2× pace</span>
              <span className="tnum">{MONTH.daysInMonth}</span>
            </div>
          </Panel>

          <Panel title="Recent" actions={<Kbd>g l</Kbd>} flush>
            <RowSelection>
              <DataTable<SampleTransaction>
                caption="Nine most recent transactions"
                hideHeader
                columns={[
                  {
                    key: "day",
                    header: "Date",
                    cell: (row) => (
                      <span className="tnum text-figure text-muted">
                        {MONTH.short} {row.day}
                      </span>
                    ),
                  },
                  { key: "desc", header: "Description", truncate: true, cell: (row) => row.description },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    numeric: true,
                    cell: (row) => <Money value={row.amount} bare />,
                  },
                ]}
                rows={RECENT}
                rowKey={(row) => row.id}
              />
            </RowSelection>
          </Panel>
        </PanelGrid>
      </Specimen>

      <Specimen title="Tables: swatches, deltas, trends, share bars">
        <PanelGrid columns="b">
          <Panel title="Categories" meta={`${MONTH.short} / ${MONTH.previousLabel} / 6 mo`} flush>
            <DataTable<SampleCategory>
              caption="Spending by category"
              columns={[
                {
                  key: "name",
                  header: "Category",
                  cell: (row) => (
                    <>
                      <Swatch color={row.color} />
                      {row.name}
                    </>
                  ),
                },
                {
                  key: "total",
                  header: MONTH.short,
                  align: "right",
                  numeric: true,
                  cell: (row) => <Money value={row.total} bare dp={0} />,
                },
                { key: "delta", header: "Δ", align: "right", numeric: true, cell: (row) => <Delta value={row.delta} /> },
                {
                  key: "trend",
                  header: "Trend",
                  cell: (row) => <Sparkline values={row.spark} height={16} color="var(--accent)" dot={false} />,
                },
              ]}
              rows={CATEGORIES}
              rowKey={(row) => row.name}
            />
          </Panel>

          <Panel title="Labels" meta={MONTH.short} flush>
            <DataTable<SampleLabel>
              caption="Spending by label"
              columns={[
                {
                  key: "name",
                  header: "Label",
                  cell: (row) => (
                    <>
                      <Swatch color={row.color} />
                      {row.name}
                    </>
                  ),
                },
                {
                  key: "count",
                  header: "#",
                  align: "right",
                  numeric: true,
                  cell: (row) => <span className="text-muted">{row.count}</span>,
                },
                {
                  key: "total",
                  header: "Amount",
                  align: "right",
                  numeric: true,
                  cell: (row) => <Money value={row.total} bare dp={0} />,
                },
                { key: "share", header: "Share", cell: (row) => <ShareBar share={row.total / biggestLabel} /> },
              ]}
              rows={LABELS}
              rowKey={(row) => row.name}
            />
          </Panel>


          <Panel title="Payment sources" flush>
            <DataTable<SampleSource>
              caption="Spending and balances by payment source"
              columns={[
                {
                  key: "name",
                  header: "Source",
                  cell: (row) => (
                    <>
                      {row.color ? <Swatch color={row.color} /> : null}
                      {row.name}
                      {row.dueDay ? <span className="ml-1 text-muted">due {row.dueDay}</span> : null}
                    </>
                  ),
                },
                {
                  key: "spend",
                  header: `${MONTH.short} spend`,
                  align: "right",
                  numeric: true,
                  cell: (row) => <Money value={row.spend} bare dp={0} />,
                },
                {
                  key: "owed",
                  header: "Owed",
                  align: "right",
                  numeric: true,
                  cell: (row) =>
                    row.owed === null ? (
                      <span className="text-muted">n/a</span>
                    ) : (
                      <Money value={row.owed} tone="expense" bare dp={0} />
                    ),
                },
                {
                  key: "util",
                  header: "Util",
                  align: "right",
                  numeric: true,
                  cell: (row) =>
                    row.utilization === null ? (
                      <span className="text-muted">n/a</span>
                    ) : (
                      <span className={row.utilization > 80 ? "text-expense" : ""}>
                        {row.utilization.toFixed(1)}%
                      </span>
                    ),
                },
              ]}
              rows={SOURCES}
              rowKey={(row) => row.name}
            />
          </Panel>
        </PanelGrid>
      </Specimen>

      <Specimen title="Grouped rows, a subtotal and a total" note="tr.sub, tr.tot, Labels hidden below 700px">
        <Panel title="Ledger" meta="2 days, 9 rows" flush>
          <DataTable<SampleTransaction>
            caption="Transactions grouped by day"
            columns={[
              { key: "time", header: "Time", cell: (row) => <span className="tnum text-figure text-muted">{row.time}</span> },
              { key: "desc", header: "Description", truncate: true, cell: (row) => row.description },
              {
                key: "labels",
                header: "Labels",
                hideBelow: "wide",
                cell: (row) => row.labels.map((label) => <Token key={label}>{label}</Token>),
              },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                numeric: true,
                cell: (row) => <Money value={-row.amount} bare />,
              },
            ]}
            sections={[
              {
                key: "28",
                label: "Monday, Sep 28",
                total: <Money value={-1_378} bare />,
                rows: RECENT.filter((row) => row.day === "28"),
              },
              {
                key: "27",
                label: "Sunday, Sep 27",
                total: <Money value={-1_455} bare />,
                rows: RECENT.filter((row) => row.day === "27"),
              },
            ]}
            rowKey={(row) => row.id}
            footer={{
              label: "Total",
              cells: [null, null, <Money key="t" value={-2_833} bare />],
            }}
          />
        </Panel>
      </Specimen>

      <Specimen title="Filter bar">
        <FilterBar>
          <label className="flex h-control flex-[1_1_220px] items-center gap-1.5 rounded-panel border border-rule bg-panel px-2">
            <span className="sr-only">Filter rows</span>
            <input
              {...{ [SEARCH_FIELD_ATTRIBUTE]: "" }}
              type="search"
              placeholder="Filter rows"
              className="min-w-0 flex-1 border-0 bg-transparent font-sans text-body text-ink outline-0"
            />
            <Kbd>/</Kbd>
          </label>
          <FilterGroup label="Date">
            <FilterToken>Today</FilterToken>
            <FilterToken defaultPressed>7d</FilterToken>
          </FilterGroup>
          <FilterGroup label="Cat">
            <FilterToken>Food &amp; Dining</FilterToken>
            <FilterToken>Transportation</FilterToken>
          </FilterGroup>
          <FilterGroup label="Card">
            <FilterToken>Cash</FilterToken>
            <FilterToken>BPI</FilterToken>
          </FilterGroup>
        </FilterBar>
      </Specimen>

      <Specimen title="Month bars and the heat table">
        <Panel title="Income / spend, 6 months" meta="bars: income, spend">
          <MonthBars months={MONTHLY} />
        </Panel>
        <div className="mt-2.5">
          <Panel title="Category × month" meta="cell shade = share of max" flush>
            <HeatTable rows={HEAT_ROWS} months={[...HEAT_MONTHS]} caption="Spending by category and month" />
          </Panel>
        </div>
      </Specimen>

      <Specimen title="No budget plan" note="no dashed budget line, and the panel says so">
        <Panel title="Cumulative spend" meta="no budget plan for this month">
          <BurnChart cumulative={CUMULATIVE} budget={null} />
        </Panel>
      </Specimen>

      <Specimen title="Empty, error and loading">
        <PanelGrid columns="b">
          <Panel flush>
            <EmptyState title={`No entries for ${MONTH.label}`}>
              Press <Kbd>n</Kbd> or type into the command bar to add the first one.
            </EmptyState>
          </Panel>
          <Panel flush>
            <ErrorState title="Could not read the ledger">
              The database did not answer. Reload, or check the connection.
            </ErrorState>
          </Panel>
          <Panel>
            <SkeletonBlock height={60} />
            <SkeletonLines lines={4} />
          </Panel>
        </PanelGrid>
      </Specimen>
    </>
  );
}
