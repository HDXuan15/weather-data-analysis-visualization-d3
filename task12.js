d3.csv("./df_weather_fixed_utf8.csv").then((rawData) => {
  const parseNumber = (value) => {
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const parseTime = d3.timeParse("%I:%M %p");

  const data = rawData
    .map((row) => {
      const sunrise = parseTime(row["Astro.Sunrise"]?.trim() ?? "");
      const sunset = parseTime(row["Astro.Sunset"]?.trim() ?? "");
      const uv = parseNumber(row["Day.Uv"]);

      return {
        sunrise,
        sunset,
        uv,
        dayLengthHours:
          sunrise instanceof Date && sunset instanceof Date
            ? (sunset.getTime() - sunrise.getTime()) / 36e5
            : NaN,
        region: row["Location.Region"],
        location: row["Location.Name"],
        date: row["Date"],
      };
    })
    .filter(
      (row) => Number.isFinite(row.dayLengthHours) && Number.isFinite(row.uv),
    );

  const svg = d3.select("#chart12");
  const tooltip = d3.select("#tooltip");
  const outerWidth = 960;
  const outerHeight = 560;
  const margin = { top: 96, right: 30, bottom: 90, left: 80 };
  const innerWidth = outerWidth - margin.left - margin.right;
  const innerHeight = outerHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.dayLengthHours))
    .nice()
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.uv))
    .nice()
    .range([innerHeight, 0]);

  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  chart.append("g").call(d3.axisLeft(y));

  chart
    .append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.dayLengthHours))
    .attr("cy", (d) => y(d.uv))
    .attr("r", 3.8)
    .attr("fill", "#0f766e")
    .attr("opacity", 0.55)
    .attr("stroke", "#0f766e")
    .attr("stroke-width", 0.6)
    .on("mouseenter", function (event, d) {
      d3.select(this)
        .transition("hover")
        .duration(120)
        .attr("r", 8)
        .attr("opacity", 0.95)
        .attr("filter", "brightness(1.25)");

      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.location || "Unknown"}</strong><br/>Region: ${d.region || "N/A"}<br/>Date: ${d.date || "N/A"}<br/>Day length: <strong>${d.dayLengthHours.toFixed(2)} h</strong><br/>UV: <strong>${d.uv}</strong>`,
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
        .attr("r", 3.8)
        .attr("opacity", 0.55)
        .attr("filter", "brightness(1)");

      tooltip.style("opacity", 0);
    });

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
});
