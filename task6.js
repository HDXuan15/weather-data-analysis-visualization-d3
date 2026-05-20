d3.csv("df_weather_fixed_utf8.csv").then((rawData) => {
  const data = rawData
    .map((row) => ({
      region: row["Location.Region"],
    }))
    .filter((row) => row.region);

  const grouped = d3
    .rollups(
      data,
      (values) => values.length,
      (d) => d.region,
    )
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => d3.descending(a.count, b.count));

  const svg = d3.select("#chart6");
  const tooltip = d3.select("#tooltip");
  const outerWidth = 960;
  const outerHeight = 560;
  const margin = { top: 96, right: 30, bottom: 130, left: 80 };
  const innerWidth = outerWidth - margin.left - margin.right;
  const innerHeight = outerHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(grouped.map((d) => d.region))
    .range([0, innerWidth])
    .padding(0.22);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(grouped, (d) => d.count) ?? 0])
    .nice()
    .range([innerHeight, 0]);

  const color = d3
    .scaleSequential()
    .domain(d3.extent(grouped, (d) => d.count))
    .interpolator(d3.interpolateReds);

  svg
    .append("text")
    .attr("class", "chart-title")
    .attr("x", outerWidth / 2)
    .attr("y", 42)
    .attr("text-anchor", "middle")
    .text("Mật độ điểm đo theo khu vực");

  svg
    .append("text")
    .attr("class", "chart-subtitle")
    .attr("x", outerWidth / 2)
    .attr("y", 66)
    .attr("text-anchor", "middle")
    .text("COUNT(*) theo Location.Region");

  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end");

  chart.append("g").call(d3.axisLeft(y));

  chart
    .append("g")
    .selectAll("rect")
    .data(grouped)
    .join("rect")
    .attr("x", (d) => x(d.region))
    .attr("y", (d) => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", (d) => innerHeight - y(d.count))
    .attr("rx", 8)
    .attr("fill", (d) => color(d.count))
    .on("mouseenter", function (event, d) {
      d3.select(this)
        .transition("hover")
        .duration(120)
        .attr("opacity", 0.8)
        .attr("filter", "brightness(1.2)");

      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.region}</strong><br/>Số lượng: <strong>${d.count.toLocaleString("vi-VN")}</strong> điểm đo`,
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
    .text("Số lượng điểm đo");
});
