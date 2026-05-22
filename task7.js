// --- CẤU HÌNH 6 LOẠI THỜI TIẾT KÈM ICON VÀ MÀU SẮC DỊU MẮT ---
const weatherConfig = {
  "Sunny": { icon: "☀️", color: "#FFB703" },         
  "Cloudy": { icon: "☁️", color: "#D6DCE5" },        
  "Fog/Mist": { icon: "🌫️", color: "#9AA5B1" },      
  "Light rain": { icon: "🌦️", color: "#2EC4B6" },    
  "Heavy rain": { icon: "🌧️", color: "#3A86FF" },    
  "Thunderstorm": { icon: "⛈️", color: "#8338EC" }   
};

const getWeatherColor = (weather) => weatherConfig[weather] ? weatherConfig[weather].color : "#14b8a6";
const getWeatherIcon = (weather) => weatherConfig[weather] ? weatherConfig[weather].icon : "🌤️";

const formatMonthDisplay = (str) => {
  if (!str) return "--";
  const parts = str.split("-");
  return parts.length === 2 ? `${parts[1]}-${parts[0]}` : str;
};

const updateTooltipPosition = (event, tooltipElement) => {
  const node = tooltipElement.node();
  const tooltipWidth = node.offsetWidth || 250;
  const tooltipHeight = node.offsetHeight || 150;

  let x = event.pageX + 12;
  let y = event.pageY + 12;

  if (x + tooltipWidth > window.innerWidth - 20) x = event.pageX - tooltipWidth - 12;
  if (y + tooltipHeight > window.innerHeight - 20) y = event.pageY - tooltipHeight - 12;

  tooltipElement.style("left", `${x}px`).style("top", `${y}px`);
};

// Cấu hình không gian SVG tối ưu (Không cần chừa lề phải quá rộng vì chú giải đã tách riêng)
const width = 750;
const height = 460;
const margin = { top: 15, right: 35, bottom: 45, left: 135 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const svg = d3.select("#chart7").attr("viewBox", `0 0 ${width} ${height}`);
const tooltip = d3.select("#tooltip");

const chartGroup = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
const xAxisGroup = chartGroup.append("g").attr("transform", `translate(0, ${innerHeight})`);
const yAxisGroup = chartGroup.append("g");

Promise.all([
  d3.csv("df_weather_fixed_utf8.csv")
]).then(([csvData]) => {
  
  const data = csvData
    .map((row) => {
      const dateObj = new Date(row["Date"]);
      return {
        monthStr: dateObj.getFullYear() + "-" + String(dateObj.getMonth() + 1).padStart(2, '0'),
        region: row["Location.Region"],
        location: row["Location.Name"],
        weather: row["Day.Condition.Text"]
      };
    })
    .filter((row) => row.weather && row.region);

  // Thiết lập bộ lọc vùng miền và thời gian
  const regions = Array.from(new Set(data.map((d) => d.region))).sort();
  const regionSelect = d3.select("#region-filter");
  regions.forEach((r) => regionSelect.append("option").attr("value", r).text(r));

  const months = Array.from(new Set(data.map((d) => d.monthStr))).sort();
  const startSelect = d3.select("#start-month");
  const endSelect = d3.select("#end-month");

  const populateSelect = (selectElement, values, selectedValue) => {
    selectElement.selectAll("option").remove();
    values.forEach((m) => {
      selectElement.append("option").attr("value", m).text(formatMonthDisplay(m));
    });
    if (values.includes(selectedValue)) {
      selectElement.property("value", selectedValue);
    } else if (values.length > 0) {
      selectElement.property("value", values[0]);
    }
  };

  const updateSelectRanges = (changed) => {
    let startVal = startSelect.property("value") || months[0];
    let endVal = endSelect.property("value") || months[months.length - 1];

    if (changed === "start" && startVal > endVal) endVal = startVal;
    if (changed === "end" && endVal < startVal) startVal = endVal;

    const allowedStartMonths = months.filter((m) => m <= endVal);
    const allowedEndMonths = months.filter((m) => m >= startVal);

    populateSelect(startSelect, allowedStartMonths, startVal);
    populateSelect(endSelect, allowedEndMonths, endVal);
  };

  updateSelectRanges();

  // --- HÀM DRAW/UPDATE ĐỒ THỊ VÀ CHÚ GIẢI ĐỘC LẬP ---
  const renderChart = () => {
    const selectedRegion = regionSelect.property("value");
    const startVal = startSelect.property("value");
    const endVal = endSelect.property("value");
    const sortOrder = d3.select("#sort-filter").property("value");

    const filteredData = data.filter((d) => {
      const matchRegion = selectedRegion === "All" || d.region === selectedRegion;
      const matchTime = d.monthStr >= startVal && d.monthStr <= endVal;
      return matchRegion && matchTime;
    });

    const totalRecords = filteredData.length;
    const groupedMap = d3.group(filteredData, d => d.weather);

    // Tính toán số liệu dựa trên 6 nhóm cố định
    let weatherStats = Object.keys(weatherConfig).map((weather) => {
      const records = groupedMap.get(weather) || [];
      const count = records.length;
      const percentage = totalRecords > 0 ? (count / totalRecords) * 100 : 0;
      
      let minProv = { loc: "Không có", count: 0 };
      let maxProv = { loc: "Không có", count: 0 };

      if (count > 0) {
        const provGroup = Array.from(d3.group(records, d => d.location), ([loc, recs]) => ({
          loc, count: recs.length
        })).sort((a, b) => a.count - b.count);
        minProv = provGroup[0];
        maxProv = provGroup[provGroup.length - 1];
      }

      return { weather, count, percentage, minProv, maxProv };
    });

    // Sắp xếp thứ tự mảng dữ liệu dựa trên Sort Bộ Lọc
    if (sortOrder === "asc") {
      weatherStats.sort((a, b) => a.count - b.count);
    } else {
      weatherStats.sort((a, b) => b.count - a.count);
    }

    // Cập nhật khối thống kê tổng quan (Top Box)
    if (totalRecords > 0) {
      const sortedForSummary = [...weatherStats].sort((a, b) => b.count - a.count);
      const highest = sortedForSummary[0];
      const lowest = sortedForSummary[sortedForSummary.length - 1];

      d3.select("#highest-weather").html(`${getWeatherIcon(highest.weather)} ${highest.weather} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${highest.count} lần - ${highest.percentage.toFixed(1)}%)</span>`);
      d3.select("#lowest-weather").html(`${getWeatherIcon(lowest.weather)} ${lowest.weather} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${lowest.count} lần - ${lowest.percentage.toFixed(1)}%)</span>`);
    } else {
      d3.select("#highest-weather").text("Không có dữ liệu");
      d3.select("#lowest-weather").text("Không có dữ liệu");
    }

    // Thang đo tọa độ Trục
    const maxCount = d3.max(weatherStats, d => d.count);
    const xScale = d3.scaleLinear()
      .domain([0, maxCount > 0 ? maxCount * 1.12 : 10]) 
      .range([0, innerWidth]);

    const yScale = d3.scaleBand()
      .domain(weatherStats.map(d => d.weather))
      .range([0, innerHeight])
      .padding(0.3);

    xAxisGroup.transition().duration(750).call(d3.axisBottom(xScale).ticks(5));
    yAxisGroup.transition().duration(750).call(d3.axisLeft(yScale));
    
    yAxisGroup.selectAll(".tick text")
      .text(d => `${getWeatherIcon(d)} ${d}`)
      .style("font-size", "13px")
      .style("font-weight", "600")
      .style("fill", "#475569");

    // --- VẼ THANH CỘT ĐỒ THỊ (BARS) ---
    const bars = chartGroup.selectAll(".bar-rect")
      .data(weatherStats, d => d.weather);

    const barsEnter = bars.enter().append("rect")
      .attr("class", "bar-rect")
      .attr("x", 0)
      .attr("y", d => yScale(d.weather))
      .attr("height", yScale.bandwidth())
      .attr("width", 0) 
      .attr("fill", d => getWeatherColor(d.weather))
      .attr("rx", 5); 

    bars.merge(barsEnter)
      .on("mouseenter", function(event, d) {
        chartGroup.selectAll(".bar-rect").classed("dimmed", true);
        d3.select(this).classed("dimmed", false);
        
        // Đồng bộ hiệu ứng làm mờ sang các thẻ HTML Chú giải bên ngoài card riêng biệt
        d3.selectAll(".legend-item").classed("dimmed", l => l.weather !== d.weather);

        let tooltipContent = `
          <strong style="font-size: 15px;">${getWeatherIcon(d.weather)} ${d.weather}</strong>
          <hr style="margin: 6px 0; border: none; border-top: 1px dashed rgba(15, 23, 42, 0.2);"/>
          Số lần xuất hiện: <strong>${d.count} lần</strong><br/>
          Tỷ lệ xuất hiện: <strong>${d.percentage.toFixed(2)}%</strong><br/>
          <span style="color: #be123c;">▲ Nhiều nhất:</span> ${d.maxProv.loc} (${d.maxProv.count} lần)<br/>
          <span style="color: #0369a1;">▼ Ít nhất:</span> ${d.minProv.loc} (${d.minProv.count} lần)
        `;
        tooltip.style("opacity", 1).html(tooltipContent);
        updateTooltipPosition(event, tooltip);
      })
      .on("mousemove", (event) => updateTooltipPosition(event, tooltip))
      .on("mouseleave", function() {
        chartGroup.selectAll(".bar-rect").classed("dimmed", false);
        d3.selectAll(".legend-item").classed("dimmed", false);
        tooltip.style("opacity", 0);
      })
      .transition().duration(750)
      .attr("y", d => yScale(d.weather))
      .attr("height", yScale.bandwidth())
      .attr("width", d => xScale(d.count));

    bars.exit().remove();

    // --- HIỂN THỊ TEXT PHẦN TRĂM (%) TRÊN ĐẦU CỘT ---
    const labels = chartGroup.selectAll(".bar-label")
      .data(weatherStats, d => d.weather);

    const labelsEnter = labels.enter().append("text")
      .attr("class", "bar-label")
      .attr("dy", "0.36em")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .attr("x", 0)
      .attr("opacity", 0);

    labels.merge(labelsEnter)
      .text(d => `${d.percentage.toFixed(1)}%`)
      .transition().duration(750)
      .attr("y", d => yScale(d.weather) + yScale.bandwidth() / 2)
      .attr("x", d => {
        const barW = xScale(d.count);
        return barW > 45 ? barW - 40 : barW + 8;
      })
      .style("fill", d => {
        const barW = xScale(d.count);
        return barW > 45 ? "#ffffff" : "#334155";
      })
      .attr("opacity", 1);

    labels.exit().remove();

    // --- RENDER DANH SÁCH CHÚ GIẢI THÀNH PHẦN TỬ HTML RIÊNG BIỆT ---
    const legendItems = d3.select("#chart-legend")
      .selectAll(".legend-item")
      .data(weatherStats, d => d.weather);

    // Khởi tạo khung DOM cho dòng chú thích mới
    const legendEnter = legendItems.enter().append("div")
      .attr("class", "legend-item")
      .on("mouseenter", function(event, d) {
        // Rà chuột vào chú giải chữ -> Làm nổi bật cột tương ứng trong SVG biểu đồ
        chartGroup.selectAll(".bar-rect").classed("dimmed", p => p.weather !== d.weather);
        d3.selectAll(".legend-item").classed("dimmed", p => p.weather !== d.weather);
      })
      .on("mouseleave", function() {
        chartGroup.selectAll(".bar-rect").classed("dimmed", false);
        d3.selectAll(".legend-item").classed("dimmed", false);
      });

    // Ô màu nhỏ vuông góc tròn giống hệt hình minh họa của bạn
    legendEnter.append("div")
      .attr("class", "legend-color-box")
      .style("width", "16px")
      .style("height", "16px")
      .style("border-radius", "4px")
      .style("flex-shrink", "0");

    // Nội dung chữ nhãn thời tiết kèm Icon và Tổng số lần
    legendEnter.append("span")
      .attr("class", "legend-text-label")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("color", "#475569");

    // Hợp nhất dữ liệu mới cũ và đồng bộ hóa sắp xếp thứ tự hiển thị (DOM re-ordering)
    const legendMerged = legendItems.merge(legendEnter);
    
    // Tự động hoán đổi vị trí thứ tự hiển thị trong HTML Card khi đổi bộ lọc Sắp xếp cột
    legendMerged.order(); 

    legendMerged.select(".legend-color-box")
      .style("background-color", d => getWeatherColor(d.weather));

    legendMerged.select(".legend-text-label")
      .text(d => `${d.weather} (${d.count} lần)`);

    legendItems.exit().remove();
  };

  renderChart();

  // Sự kiện kích hoạt lại bộ lọc
  regionSelect.on("change", renderChart);
  d3.select("#sort-filter").on("change", renderChart);
  startSelect.on("change", () => {
    updateSelectRanges("start");
    renderChart();
  });
  endSelect.on("change", () => {
    updateSelectRanges("end");
    renderChart();
  });
});