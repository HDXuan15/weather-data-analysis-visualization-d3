d3.csv("./df_weather_fixed_utf8.csv").then((rawData) => {
  const parseNumber = (value) => {
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const data = rawData
    .map((row) => ({
      region: row["Location.Region"],
      avgTemp: parseNumber(row["Day.Avgtemp C"]),
    }))
    .filter((row) => row.region && Number.isFinite(row.avgTemp));

  const grouped = d3
    .rollups(
      data,
      (values) => d3.mean(values, (d) => d.avgTemp),
      (d) => d.region,
    )
    .map(([region, avgTemp]) => ({ region, avgTemp }))
    .sort((a, b) => d3.descending(a.avgTemp, b.avgTemp));

  // Thống kê: vùng có nhiệt độ trung bình cao nhất và thấp nhất
  if (grouped.length > 0) {
    const maxRegion = grouped[0];
    const minRegion = grouped[grouped.length - 1];
    const statsEl = document.getElementById("stats");
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="summary-box">
          <div class="stat-item">
            <div style="color: #be123c; font-weight: bold; font-size: 13px; text-transform: uppercase;">🔥 Nơi có nhiệt độ cao nhất</div>
            <div id="highest-temp" style="font-size: 18px; font-weight:700; margin-top:8px;">${maxRegion.region} — ${maxRegion.avgTemp.toFixed(2)}°C</div>
          </div>
          <div class="stat-item">
            <div style="color: #0369a1; font-weight: bold; font-size: 13px; text-transform: uppercase;">❄️ Nơi có nhiệt độ thấp nhất</div>
            <div id="lowest-temp" style="font-size: 18px; font-weight:700; margin-top:8px;">${minRegion.region} — ${minRegion.avgTemp.toFixed(2)}°C</div>
          </div>
        </div>
      `;
    }
  }

  const tooltip = d3.select("#tooltip");
  const sortButtons = {
    ascending: document.getElementById("sort-ascending"),
    descending: document.getElementById("sort-descending"),
  };

  const svg = d3.select("#chart2");
  const outerWidth = 960;
  const outerHeight = 560;
  const margin = { top: 96, right: 30, bottom: 130, left: 80 };
  const innerWidth = outerWidth - margin.left - margin.right;
  const innerHeight = outerHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const barsGroup = chart.append("g").attr("class", "bars");
  const xAxisGroup = chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`);
  const yAxisGroup = chart.append("g");

  const x = d3
    .scaleBand()
    .domain(grouped.map((d) => d.region))
    .range([0, innerWidth])
    .padding(0.22);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(grouped, (d) => d.avgTemp) ?? 0])
    .nice()
    .range([innerHeight, 0]);

  const color = d3
    .scaleSequential()
    .domain(d3.extent(grouped, (d) => d.avgTemp))
    .interpolator(d3.interpolatePurples);

  const applyXAxisLabelStyle = () => {
    xAxisGroup
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");
  };

  const attachBarInteractions = (selection) => {
    selection
      .on("mouseenter", function (event, d) {
        d3.select(this)
          .transition("hover")
          .duration(120)
          .attr("opacity", 0.8)
          .attr("filter", "brightness(1.2)");

        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.region}</strong><br/>Avg Temp: <strong>${d.avgTemp.toFixed(2)}°C</strong>`,
          )
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY + 12}px`);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY + 12}px`);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition("hover")
          .duration(120)
          .attr("opacity", 1)
          .attr("filter", "brightness(1)");

        tooltip.style("opacity", 0);
      });
  };

  const renderChart = (order) => {
    const sortedData = [...grouped].sort((a, b) => {
      if (order === "ascending") {
        return d3.ascending(a.avgTemp, b.avgTemp);
      }

      return d3.descending(a.avgTemp, b.avgTemp);
    });

    x.domain(sortedData.map((d) => d.region));

    const sortTransition = d3.transition().duration(1000).ease(d3.easeCubic);

    xAxisGroup.transition(sortTransition).call(d3.axisBottom(x));
    applyXAxisLabelStyle();
    yAxisGroup.call(d3.axisLeft(y));

    barsGroup
      .selectAll("rect")
      .data(sortedData, (d) => d.region)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("x", (d) => x(d.region))
            .attr("y", (d) => y(d.avgTemp))
            .attr("width", x.bandwidth())
            .attr("height", (d) => innerHeight - y(d.avgTemp))
            .attr("rx", 8)
            .attr("fill", (d) => color(d.avgTemp))
            .call(attachBarInteractions),
        (update) =>
          update
            .transition(sortTransition)
            .attr("x", (d) => x(d.region))
            .attr("y", (d) => y(d.avgTemp))
            .attr("width", x.bandwidth())
            .attr("height", (d) => innerHeight - y(d.avgTemp))
            .attr("fill", (d) => color(d.avgTemp)),
        (exit) => exit.remove(),
      );
  };

  renderChart("descending");

  sortButtons.ascending?.addEventListener("click", () =>
    renderChart("ascending"),
  );
  sortButtons.descending?.addEventListener("click", () =>
    renderChart("descending"),
  );

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", outerHeight - 24)
    .attr("text-anchor", "middle")
    .text("Vùng miền (Location.Region)");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + innerHeight / 2))
    .attr("y", 26)
    .attr("text-anchor", "middle")
    .text("Nhiệt độ trung bình (°C)");
});
