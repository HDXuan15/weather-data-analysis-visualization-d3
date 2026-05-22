const updateTooltipPosition = (event, tooltipElement) => {
  const node = tooltipElement.node();
  const tooltipWidth = node.offsetWidth || 250;
  const tooltipHeight = node.offsetHeight || 150;

  let x = event.pageX + 15;
  let y = event.pageY - (tooltipHeight / 2);

  if (x + tooltipWidth > window.innerWidth - 20) x = event.pageX - tooltipWidth - 15;
  if (y + tooltipHeight > window.innerHeight - 20) y = window.innerHeight - tooltipHeight - 20;
  if (y < 20) y = 20;

  tooltipElement.style("left", `${x}px`).style("top", `${y}px`);
};

const formatMonthDisplay = (str) => {
  if (!str) return "--";
  const parts = str.split("-");
  if (parts.length === 2) {
    return `${parts[1]}-${parts[0]}`; 
  }
  return str;
};

d3.csv("df_weather_fixed_utf8.csv").then((rawData) => {
  const parseNumber = (value) => {
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const data = rawData
    .map((row) => {
      const dateObj = new Date(row["Date"]);
      return {
        dateObj: dateObj,
        monthStr: dateObj.getFullYear() + "-" + String(dateObj.getMonth() + 1).padStart(2, '0'),
        region: row["Location.Region"],
        location: row["Location.Name"],
        avgTemp: parseNumber(row["Day.Avgtemp C"]),
      };
    })
    .filter((row) => row.region && !isNaN(row.avgTemp) && !isNaN(row.dateObj));

  const regions = Array.from(new Set(data.map((d) => d.region))).sort();
  const months = Array.from(new Set(data.map((d) => d.monthStr))).sort();

  const customColors = ["#dc2626", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#ff00ae"];
  const colorScale = d3.scaleOrdinal(customColors).domain(regions);

  const select = d3.select("#region-filter");
  regions.forEach((region) => {
    select.append("option").attr("value", region).text(region);
  });

  const legendContainer = d3.select("#legend-container");
  regions.forEach((r) => {
    const item = legendContainer.append("div").attr("class", "legend-item");
    item.append("div").attr("class", "legend-color").style("background", colorScale(r));
    item.append("span").text(r);
    
    item.on("mouseenter", () => {
      d3.selectAll(".line").classed("dimmed", d => d.region !== r);
      d3.selectAll(".dot").classed("dimmed", d => d.region !== r);
    }).on("mouseleave", () => {
      d3.selectAll(".line").classed("dimmed", false);
      d3.selectAll(".dot").classed("dimmed", false);
    });
  });

  const tooltip = d3.select("#tooltip");

  const svg = d3.select("#chart1");
  const outerWidth = 960;
  const outerHeight = 550;
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const innerWidth = outerWidth - margin.left - margin.right;
  const innerHeight = outerHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const xAxisGroup = chart.append("g").attr("transform", `translate(0,${innerHeight})`);
  const yAxisGroup = chart.append("g");
  
  const linesLayer = chart.append("g").attr("class", "lines-layer");
  const dotsLayer = chart.append("g").attr("class", "dots-layer");

  const x = d3.scalePoint().domain(months).range([0, innerWidth]).padding(0.5);
  const y = d3.scaleLinear().range([innerHeight, 0]);

  svg.append("text").attr("class", "axis-label").attr("x", margin.left + innerWidth / 2).attr("y", outerHeight - 10).attr("text-anchor", "middle").text("Thời gian (Tháng-Năm)");
  svg.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("x", -(margin.top + innerHeight / 2)).attr("y", 20).attr("text-anchor", "middle").text("Nhiệt độ trung bình (°C)");

  const regionGroups = d3.groups(data, (d) => d.region).map(([region, regionData]) => {
    const monthlyGroups = d3.groups(regionData, (d) => d.monthStr).map(([monthStr, monthData]) => {
      const avgTemp = d3.mean(monthData, (d) => d.avgTemp);
      
      const locGroups = d3.groups(monthData, (d) => d.location).map(([loc, locRecords]) => ({
        loc, avg: d3.mean(locRecords, (d) => d.avgTemp),
      })).sort((a, b) => d3.ascending(a.avg, b.avg));
      
      return {
        region,
        monthStr,
        avgTemp,
        lowestLoc: locGroups[0],
        highestLoc: locGroups[locGroups.length - 1],
      };
    }).sort((a, b) => d3.ascending(a.monthStr, b.monthStr));

    const overallAvg = d3.mean(monthlyGroups, (d) => d.avgTemp);
    const sortedMonths = [...monthlyGroups].sort((a, b) => d3.ascending(a.avgTemp, b.avgTemp));

    return {
      region,
      overallAvg,
      monthlyData: monthlyGroups,
      minMonth: sortedMonths[0],
      maxMonth: sortedMonths[sortedMonths.length - 1],
    };
  });

  const lineGenerator = d3.line()
    .x((d) => x(d.monthStr))
    .y((d) => y(d.avgTemp))
    .curve(d3.curveMonotoneX);

  const renderChart = (selectedRegion) => {
    const activeRegions = selectedRegion === "All" 
      ? regionGroups 
      : regionGroups.filter((d) => d.region === selectedRegion);

    if (activeRegions.length === 0) return;

    if (selectedRegion === "All") {
      const sortedActiveRegions = [...activeRegions].sort((a, b) => d3.ascending(a.overallAvg, b.overallAvg));
      const minReg = sortedActiveRegions[0];
      const maxReg = sortedActiveRegions[sortedActiveRegions.length - 1];

      d3.select("#highest-title").text("🔥 Vùng có nhiệt độ TB cao nhất");
      d3.select("#lowest-title").text("❄️ Vùng có nhiệt độ TB thấp nhất");

      d3.select("#highest-val").html(`${maxReg?.region || "--"} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${maxReg?.overallAvg?.toFixed(2) || 0}°C)</span>`);
      d3.select("#lowest-val").html(`${minReg?.region || "--"} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${minReg?.overallAvg?.toFixed(2) || 0}°C)</span>`);
    } 
    else {
      const regionData = activeRegions[0];
      const maxMonth = regionData?.maxMonth;
      const minMonth = regionData?.minMonth;

      d3.select("#highest-title").text("🔥 Tháng có nhiệt độ TB cao nhất");
      d3.select("#lowest-title").text("❄️ Tháng có nhiệt độ TB thấp nhất");

      d3.select("#highest-val").html(`Tháng ${formatMonthDisplay(maxMonth?.monthStr)} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${maxMonth?.avgTemp?.toFixed(2) || 0}°C)</span>`);
      d3.select("#lowest-val").html(`Tháng ${formatMonthDisplay(minMonth?.monthStr)} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${minMonth?.avgTemp?.toFixed(2) || 0}°C)</span>`);
    }

    const allMonthsData = activeRegions.flatMap(d => d.monthlyData);
    const yMax = d3.max(allMonthsData, d => d.avgTemp) || 0;
    const yMin = d3.min(allMonthsData, d => d.avgTemp) || 0;
    y.domain([yMin - 1, yMax + 1]).nice();

    const transitionConf = d3.transition().duration(800).ease(d3.easeCubic);

    xAxisGroup.transition(transitionConf).call(d3.axisBottom(x).tickFormat(d => formatMonthDisplay(d)));
    xAxisGroup.selectAll("text").attr("transform", "rotate(-35)").style("text-anchor", "end");
    yAxisGroup.transition(transitionConf).call(d3.axisLeft(y));

    const lines = linesLayer.selectAll(".line")
      .data(activeRegions, d => d.region)
      .join(
        enter => enter.append("path")
          .attr("class", "line")
          .style("opacity", 0)
          .call(enter => enter.transition(transitionConf).style("opacity", 1)),
        update => update,
        exit => exit.call(exit => exit.transition(transitionConf).style("opacity", 0).remove())
      );

    lines.style("stroke", d => colorScale(d.region), "important");
    lines.transition(transitionConf).attr("d", d => lineGenerator(d.monthlyData));

    lines.on("mouseenter", function (event, d) {
      linesLayer.selectAll(".line").classed("dimmed", true);
      dotsLayer.selectAll(".dot").classed("dimmed", true);
      d3.select(this).classed("dimmed", false);

      // Cập nhật Tooltip của Line
      tooltip.style("opacity", 1).html(`
        <strong style="font-size: 14px;">Vùng: ${d.region}</strong><br>
        Nhiệt độ TB tất cả tháng: <strong>${d.overallAvg?.toFixed(2) || 0}°C</strong>
        <hr style="margin: 6px 0; border: none; border-top: 1px dashed rgba(15, 23, 42, 0.2);"/>
        <span style="color: #be123c;">🔥 Tháng nóng nhất:</span> ${formatMonthDisplay(d.maxMonth?.monthStr)} (${d.maxMonth?.avgTemp?.toFixed(2) || 0}°C)<br>
        <span style="color: #0369a1;">❄️ Tháng lạnh nhất:</span> ${formatMonthDisplay(d.minMonth?.monthStr)} (${d.minMonth?.avgTemp?.toFixed(2) || 0}°C)
      `);
      updateTooltipPosition(event, tooltip);
    })
    .on("mousemove", (event) => updateTooltipPosition(event, tooltip))
    .on("mouseleave", function () {
      linesLayer.selectAll(".line").classed("dimmed", false);
      dotsLayer.selectAll(".dot").classed("dimmed", false);
      tooltip.style("opacity", 0);
    });

    const dots = dotsLayer.selectAll(".dot")
      .data(allMonthsData, d => d.region + d.monthStr)
      .join(
        enter => enter.append("circle")
          .attr("class", "dot")
          .attr("r", 0)
          .call(enter => enter.transition(transitionConf).attr("r", 4.5)),
        update => update,
        exit => exit.call(exit => exit.transition(transitionConf).attr("r", 0).remove())
      );

    dots.style("fill", d => colorScale(d.region), "important");
    dots.transition(transitionConf).attr("cx", d => x(d.monthStr)).attr("cy", d => y(d.avgTemp));

    dots.on("mouseenter", function (event, d) {
      event.stopPropagation();
      d3.select(this).attr("r", 8).attr("filter", "brightness(1.1)");
      
      // Cập nhật Tooltip của Dot
      tooltip.style("opacity", 1).html(`
        <strong>${d.region} - Tháng: ${formatMonthDisplay(d.monthStr)}</strong><br>
        Nhiệt độ TB tháng: <strong>${d.avgTemp?.toFixed(2) || 0}°C</strong>
        <hr style="margin: 6px 0; border: none; border-top: 1px dashed rgba(15, 23, 42, 0.2);"/>
        <span style="color: #be123c;">▲ Nơi cao nhất:</span> ${d.highestLoc?.loc || "--"} (${d.highestLoc?.avg?.toFixed(2) || 0}°C)<br>
        <span style="color: #0369a1;">▼ Nơi thấp nhất:</span> ${d.lowestLoc?.loc || "--"} (${d.lowestLoc?.avg?.toFixed(2) || 0}°C)
      `);
      updateTooltipPosition(event, tooltip);
    })
    .on("mousemove", (event) => updateTooltipPosition(event, tooltip))
    .on("mouseleave", function (event) {
      event.stopPropagation();
      d3.select(this).attr("r", 4.5).attr("filter", null);
      tooltip.style("opacity", 0);
    });
  };

  renderChart("All");

  select.on("change", (event) => {
    const val = event.target.value;
    if (val) renderChart(val);
  });
});