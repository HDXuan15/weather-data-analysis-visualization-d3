d3.csv("df_weather_fixed_utf8.csv").then((rawData) => {
  const parseNumber = (value) => {
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  // Làm sạch và format dữ liệu
  const data = rawData
    .map((row) => {
      const dateObj = new Date(row["Date"]);
      return {
        dateObj: dateObj,
        // Tạo format YYYY-MM cho trục X
        monthStr: dateObj.getFullYear() + "-" + String(dateObj.getMonth() + 1).padStart(2, '0'),
        region: row["Location.Region"],
        location: row["Location.Name"],
        avgTemp: parseNumber(row["Day.Avgtemp C"]),
      };
    })
    .filter((row) => row.region && !isNaN(row.avgTemp) && !isNaN(row.dateObj));

  // Tự động lấy danh sách Region cho Dropdown
  const regions = Array.from(new Set(data.map((d) => d.region))).sort();
  const select = d3.select("#region-filter");
  regions.forEach((region) => {
    select.append("option").attr("value", region).text(region);
  });

  const tooltip = d3.select("#tooltip");
  const summaryBox = d3.select("#summary-box");

  // Thiết lập SVG và Margins
  const svg = d3.select("#chart1");
  const outerWidth = 960;
  const outerHeight = 500;
  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const innerWidth = outerWidth - margin.left - margin.right;
  const innerHeight = outerHeight - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xAxisGroup = chart.append("g").attr("transform", `translate(0,${innerHeight})`);
  const yAxisGroup = chart.append("g");
  const path = chart.append("path").attr("class", "line");
  const dotsGroup = chart.append("g").attr("class", "dots");

  // Thiết lập các thanh Scale (ScalePoint cho chuỗi tháng, ScaleLinear cho Nhiệt độ)
  const x = d3.scalePoint().range([0, innerWidth]).padding(0.5);
  const y = d3.scaleLinear().range([innerHeight, 0]);

  // Labels cho biểu đồ
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", outerHeight - 10)
    .attr("text-anchor", "middle")
    .text("Thời gian (Năm-Tháng)");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + innerHeight / 2))
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Nhiệt độ trung bình (°C)");

  // Hàm Render biểu đồ (chạy lại mỗi khi đổi Filter)
  const renderChart = (selectedRegion) => {
    // 1. Lọc theo vùng
    const filteredData =
      selectedRegion === "All"
        ? data
        : data.filter((d) => d.region === selectedRegion);

    // 2. Gom nhóm theo tháng (Month)
    const groupedByMonth = d3.groups(filteredData, (d) => d.monthStr);
    
    // Sắp xếp dữ liệu theo thứ tự thời gian
    groupedByMonth.sort((a, b) => d3.ascending(a[0], b[0]));

    const monthlyData = groupedByMonth.map(([monthStr, monthRecords]) => {
      // Nhiệt độ TB của cả tháng
      const overallAvg = d3.mean(monthRecords, (d) => d.avgTemp);

      // Tìm nơi (location) có nhiệt độ cao nhất / thấp nhất trong tháng đó
      const groupedByLoc = d3.groups(monthRecords, (d) => d.location);
      const locAvgs = groupedByLoc.map(([loc, locRecords]) => ({
        location: loc,
        avg: d3.mean(locRecords, (d) => d.avgTemp),
      }));

      // Sort các location theo nhiệt độ
      locAvgs.sort((a, b) => d3.ascending(a.avg, b.avg));
      
      const lowestLoc = locAvgs[0];
      const highestLoc = locAvgs[locAvgs.length - 1];

      return {
        monthStr,
        avgTemp: overallAvg,
        highestLoc,
        lowestLoc,
      };
    });

    if (monthlyData.length === 0) {
      path.attr("d", "");
      dotsGroup.selectAll("circle").remove();
      summaryBox.html("Không có dữ liệu cho vùng này.");
      return;
    }

    // --- Tính toán khoảng thời gian (tháng) có nhiệt độ cao nhất / thấp nhất ---
    const sortedByTemp = [...monthlyData].sort((a, b) => d3.ascending(a.avgTemp, b.avgTemp));
    const minMonth = sortedByTemp[0];
    const maxMonth = sortedByTemp[sortedByTemp.length - 1];

    summaryBox.html(`
      <strong>Thống kê khoảng thời gian:</strong><br>
      • Tháng có nhiệt độ trung bình <strong>cao nhất</strong>: <span style="color: #be123c;">${maxMonth.monthStr}</span> (${maxMonth.avgTemp.toFixed(2)}°C)<br>
      • Tháng có nhiệt độ trung bình <strong>thấp nhất</strong>: <span style="color: #0369a1;">${minMonth.monthStr}</span> (${minMonth.avgTemp.toFixed(2)}°C)
    `);

    // --- Update Scale ---
    x.domain(monthlyData.map((d) => d.monthStr));
    const yMax = d3.max(monthlyData, (d) => d.avgTemp);
    const yMin = d3.min(monthlyData, (d) => d.avgTemp);
    
    const yPadding = (yMax - yMin) * 0.2 || 2; 
    y.domain([yMin - yPadding, yMax + yPadding]).nice();

    const transitionConf = d3.transition().duration(800).ease(d3.easeCubic);

    // Update Axes
    xAxisGroup.transition(transitionConf).call(d3.axisBottom(x));
    xAxisGroup.selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

    yAxisGroup.transition(transitionConf).call(d3.axisLeft(y));

    // Update Line Path
    const lineGenerator = d3
      .line()
      .x((d) => x(d.monthStr))
      .y((d) => y(d.avgTemp))
      .curve(d3.curveMonotoneX); // Làm cong đường vẽ (smooth)

    path
      .datum(monthlyData)
      .transition(transitionConf)
      .attr("d", lineGenerator);

    // --- Vẽ Points và Xử lý Hover (Tooltip) ---
    dotsGroup
      .selectAll("circle")
      .data(monthlyData, (d) => d.monthStr)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "dot")
            .attr("cx", (d) => x(d.monthStr))
            .attr("cy", (d) => y(d.avgTemp))
            .attr("r", 0)
            .call((enter) => enter.transition(transitionConf).attr("r", 5)),
        (update) =>
          update.call((update) =>
            update
              .transition(transitionConf)
              .attr("cx", (d) => x(d.monthStr))
              .attr("cy", (d) => y(d.avgTemp))
          ),
        (exit) =>
          exit.call((exit) =>
            exit.transition(transitionConf).attr("r", 0).remove()
          )
      )
      .on("mouseenter", function (event, d) {
        // Highlighting point
        d3.select(this).attr("r", 8).attr("filter", "brightness(1.2)");
        
        // Hiện Tooltip
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>Tháng: ${d.monthStr}</strong><br/>
             Nhiệt độ trung bình: <strong>${d.avgTemp.toFixed(2)}°C</strong>
             <hr style="margin: 6px 0; border: none; border-top: 1px dashed rgba(15, 23, 42, 0.2);"/>
             <span style="color: #be123c;">▲ Cao nhất:</span> ${d.highestLoc.location} (${d.highestLoc.avg.toFixed(2)}°C)<br/>
             <span style="color: #0369a1;">▼ Thấp nhất:</span> ${d.lowestLoc.location} (${d.lowestLoc.avg.toFixed(2)}°C)`
          )
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY + 15}px`);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY + 15}px`);
      })
      .on("mouseleave", function () {
        // Reset point
        d3.select(this).attr("r", 5).attr("filter", null);
        // Ẩn Tooltip
        tooltip.style("opacity", 0);
      });
  };

  // Render lần đầu tiên với "Tất cả các vùng"
  renderChart("All");

  // Bắt sự kiện khi người dùng thay đổi Dropdown
  select.on("change", function () {
    renderChart(this.value);
  });
});