// Modularized scatter plot for Task 12
// - loadData()
// - renderChart()
// - updateFilter()
// - showTooltip()

const DATA_PATH = "./df_weather_fixed_utf8.csv";
const TRANS_DUR = 800; // transition duration

const svg = d3.select("#chart12");
const tooltip = d3.select("#tooltip");
const regionSelect = document.getElementById("region-filter");
const legendContainer = d3.select("#legend-region");
const analysisNote = document.getElementById("analysis-note");

const outerWidth = 960;
const outerHeight = 560;
const margin = { top: 56, right: 34, bottom: 82, left: 82 };
const innerWidth = outerWidth - margin.left - margin.right;
const innerHeight = outerHeight - margin.top - margin.bottom;

svg.attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

const chartG = svg
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Axis groups
const xGridG = chartG.append("g").attr("class", "x-grid");
const yGridG = chartG.append("g").attr("class", "y-grid");
const xAxisG = chartG
  .append("g")
  .attr("transform", `translate(0,${innerHeight})`);
const yAxisG = chartG.append("g");

// Container for points and regression
const pointsG = chartG.append("g").attr("class", "points-group");
const regG = chartG.append("g").attr("class", "regression-group");

let rawData = [];
let processed = [];
let colorScale;
let xScale;
let yScale;

// Flexible time parser: try 12h then 24h
const parseTimeFlexible = (s) => {
  if (!s) return null;
  const t1 = d3.timeParse("%I:%M %p")(s);
  if (t1) return t1;
  const t2 = d3.timeParse("%H:%M")(s);
  return t2;
};

function parseNumber(v) {
  const n = Number(
    String(v ?? "")
      .trim()
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : NaN;
}

// Load CSV and preprocess
async function loadData() {
  rawData = await d3.csv(DATA_PATH);

  processed = rawData
    .map((row) => {
      const sunrise = parseTimeFlexible(row["Astro.Sunrise"]?.trim());
      const sunset = parseTimeFlexible(row["Astro.Sunset"]?.trim());
      const uv = parseNumber(row["Day.Uv"]);
      const dayLengthHours =
        sunrise instanceof Date && sunset instanceof Date
          ? (sunset.getTime() - sunrise.getTime()) / 36e5
          : NaN;

      return {
        sunrise,
        sunset,
        uv,
        dayLengthHours,
        region: row["Location.Region"] || "Unknown",
        location: row["Location.Name"] || "",
        date: row["Date"] || "",
      };
    })
    .filter((d) => Number.isFinite(d.dayLengthHours) && Number.isFinite(d.uv));

  // derive regions
  const regions = Array.from(new Set(processed.map((d) => d.region))).sort();

  // populate filter select
  regionSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "__ALL__";
  allOpt.text = "All Regions";
  regionSelect.appendChild(allOpt);
  regions.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.text = r;
    regionSelect.appendChild(opt);
  });

  // color scale
  colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(regions);

  // initial render
  renderChart(processed);

  // legend
  renderLegend(regions);

  // hook filter
  regionSelect.addEventListener("change", updateFilter);
}

function renderLegend(regions) {
  legendContainer.html("");

  const items = legendContainer
    .selectAll(".legend-item")
    .data(regions)
    .join("div")
    .attr("class", "legend-item");

  items
    .append("div")
    .style("width", "12px")
    .style("height", "12px")
    .style("border-radius", "2px")
    .style("background", (d) => colorScale(d));

  items.append("span").text((d) => d);
}

// render chart from data (array)
function renderChart(data) {
  // scales
  xScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.dayLengthHours))
    .nice()
    .range([0, innerWidth]);

  yScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.uv))
    .nice()
    .range([innerHeight, 0]);

  const xTicks = Math.max(6, Math.floor(innerWidth / 120));
  const yTicks = Math.max(5, Math.floor(innerHeight / 90));

  xGridG
    .attr("transform", `translate(0,${innerHeight})`)
    .transition()
    .duration(TRANS_DUR)
    .call(
      d3.axisBottom(xScale).ticks(xTicks).tickSize(-innerHeight).tickFormat(""),
    );

  yGridG
    .transition()
    .duration(TRANS_DUR)
    .call(
      d3.axisLeft(yScale).ticks(yTicks).tickSize(-innerWidth).tickFormat(""),
    );

  xGridG.select(".domain").remove();
  yGridG.select(".domain").remove();
  xGridG
    .selectAll("line")
    .attr("stroke", "#cfd8e3")
    .attr("stroke-opacity", 0.65)
    .attr("shape-rendering", "crispEdges");
  yGridG
    .selectAll("line")
    .attr("stroke", "#cfd8e3")
    .attr("stroke-opacity", 0.65)
    .attr("shape-rendering", "crispEdges");

  // axes
  xAxisG
    .transition()
    .duration(TRANS_DUR)
    .call(d3.axisBottom(xScale).ticks(xTicks));
  yAxisG
    .transition()
    .duration(TRANS_DUR)
    .call(d3.axisLeft(yScale).ticks(yTicks));

  xAxisG.select(".domain").attr("stroke", "#94a3b8").attr("stroke-width", 1.1);
  yAxisG.select(".domain").attr("stroke", "#94a3b8").attr("stroke-width", 1.1);
  xAxisG.selectAll("text").attr("fill", "#334155").style("font-weight", 600);
  yAxisG.selectAll("text").attr("fill", "#334155").style("font-weight", 600);
  xAxisG.selectAll("line").attr("stroke", "#9aa8bc");
  yAxisG.selectAll("line").attr("stroke", "#9aa8bc");

  // axis labels (clear previous then add)
  svg.selectAll(".axis-label").remove();
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", outerHeight - 24)
    .attr("text-anchor", "middle")
    .text("Độ dài ban ngày = Giờ mặt trời lặn - Giờ mặt trời mọc (h)");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + innerHeight / 2))
    .attr("y", 26)
    .attr("text-anchor", "middle")
    .text("UV");

  updatePoints(data);
  drawRegression(data);
}

function updatePoints(data) {
  // jitter in pixels to reduce overplotting
  const jitterPx = 4;

  const circles = pointsG
    .selectAll("circle")
    .data(data, (d, i) => d.location + "|" + d.date + "|" + i);

  // exit
  circles.exit().transition().duration(TRANS_DUR).attr("r", 0).remove();

  // enter
  const enter = circles
    .enter()
    .append("circle")
    .attr(
      "cx",
      (d) => xScale(d.dayLengthHours) + (Math.random() - 0.5) * jitterPx,
    )
    .attr("cy", (d) => yScale(d.uv) + (Math.random() - 0.5) * 1)
    .attr("r", 0)
    .attr("fill", (d) => colorScale(d.region))
    .attr("opacity", 0.6)
    .attr("stroke", "#222")
    .attr("stroke-width", 0.2)
    .on("mouseenter", function (event, d) {
      d3.select(this)
        .raise()
        .transition()
        .duration(120)
        .attr("r", 7)
        .attr("opacity", 1);
      showTooltip(event, d);
    })
    .on("mousemove", function (event, d) {
      showTooltip(event, d);
    })
    .on("mouseleave", function () {
      d3.select(this)
        .transition()
        .duration(120)
        .attr("r", 3.8)
        .attr("opacity", 0.6);
      hideTooltip();
    });

  // merge + transition
  enter
    .merge(circles)
    .transition()
    .duration(TRANS_DUR)
    .attr(
      "cx",
      (d) => xScale(d.dayLengthHours) + (Math.random() - 0.5) * jitterPx,
    )
    .attr("cy", (d) => yScale(d.uv))
    .attr("r", 3.8)
    .attr("fill", (d) => colorScale(d.region))
    .attr("opacity", 0.6);
}

function showTooltip(event, d) {
  tooltip
    .style("opacity", 1)
    .html(
      `<strong>${d.location || "Unknown"}</strong><br/>Region: ${d.region}<br/>Day length: <strong>${d.dayLengthHours.toFixed(2)} h</strong><br/>UV: <strong>${d.uv}</strong>`,
    )
    .style("left", `${event.pageX + 12}px`)
    .style("top", `${event.pageY + 12}px`);
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

function updateFilter() {
  const sel = regionSelect.value;
  const filtered =
    sel === "__ALL__" ? processed : processed.filter((d) => d.region === sel);
  renderChart(filtered);
}

// compute linear regression (slope, intercept) and Pearson r
function computeRegression(data) {
  const n = data.length;
  if (n < 2) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (const d of data) {
    const x = d.dayLengthHours;
    const y = d.uv;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const r =
    (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  return { slope, intercept, r };
}

function drawRegression(data) {
  regG.selectAll("line.reg").remove();
  regG.selectAll("text.reg-note").remove();
  if (data.length < 2) return;
  const reg = computeRegression(data);
  if (!reg) return;

  // points for line
  const xDom = d3.extent(data, (d) => d.dayLengthHours);
  const p1 = { x: xDom[0], y: reg.slope * xDom[0] + reg.intercept };
  const p2 = { x: xDom[1], y: reg.slope * xDom[1] + reg.intercept };

  regG
    .append("line")
    .attr("class", "reg")
    .attr("x1", xScale(p1.x))
    .attr("y1", yScale(p1.y))
    .attr("x2", xScale(p1.x))
    .attr("y2", yScale(p1.y))
    .attr("stroke", "#000000")
    .attr("stroke-width", 3.5)
    .attr("stroke-linecap", "round")
    .transition()
    .duration(TRANS_DUR)
    .attr("x2", xScale(p2.x))
    .attr("y2", yScale(p2.y));

  regG
    .append("text")
    .attr("class", "reg-note")
    .attr("x", innerWidth - 6)
    .attr("y", 16)
    .attr("text-anchor", "end")
    .attr("font-size", 13)
    .attr("font-weight", 800)
    .attr("fill", "#0f172a")
    .text(`Correlation: r = ${reg.r.toFixed(3)}`);

  // analysis note
  const note =
    reg.r >= 0
      ? `UV có xu hướng tăng khi độ dài ban ngày tăng (r = ${reg.r.toFixed(3)})`
      : `Không thấy xu hướng tăng tuyến tính rõ ràng giữa UV và độ dài ban ngày (r = ${reg.r.toFixed(3)})`;
  if (analysisNote) analysisNote.innerText = note;
}

// initial load + animation
loadData().then(() => {
  // entrance animation: fade in SVG content
  svg.style("opacity", 0);
  svg.transition().duration(600).style("opacity", 1);
});

// expose updateFilter to global in case needed
window.updateFilter = updateFilter;
