// --- CẤU HÌNH 6 LOẠI THỜI TIẾT KÈM ICON VÀ MÀU SẮC DỊU MẮT ---
const weatherConfig = {
  "Sunny": { icon: "☀️", color: "#FFB703" },         
  "Cloudy": { icon: "☁️", color: "#D6DCE5" },        
  "Fog/Mist": { icon: "🌫️", color: "#9AA5B1" },      
  "Light rain": { icon: "🌦️", color: "#2EC4B6" },    
  "Heavy rain": { icon: "🌧️", color: "#3A86FF" },    
  "Thunderstorm": { icon: "⛈️", color: "#8338EC" }   
};

// Hàm lấy màu & icon (Nếu xuất hiện thời tiết ngoài 6 loại này sẽ dùng màu/icon mặc định)
const getWeatherColor = (weather) => weatherConfig[weather] ? weatherConfig[weather].color : "#14b8a6";
const getWeatherIcon = (weather) => weatherConfig[weather] ? weatherConfig[weather].icon : "🌤️";

// Hàm định dạng Tháng-Năm để hiển thị
const formatMonthDisplay = (str) => {
  if (!str) return "--";
  const parts = str.split("-");
  return parts.length === 2 ? `${parts[1]}-${parts[0]}` : str;
};

// Hàm tính toán và chống tràn tooltip
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

const svg = d3.select("#chart7");
const width = 900;
const height = 550;
const radius = Math.min(width, height) / 2.5;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const tooltip = d3.select("#tooltip");

// Biểu đồ nằm lệch trái 1 chút để nhường chỗ cho chú giải bên phải
const chartGroup = svg.append("g").attr("transform", `translate(${width / 2 - 100}, ${height / 2})`);
const legendGroup = svg.append("g").attr("transform", `translate(${width - 250}, 60)`);

Promise.all([
  d3.csv("df_weather_fixed_utf8.csv")
]).then(([csvData]) => {
  
  // 1. Làm sạch dữ liệu (vẫn giữ YYYY-MM để D3 lọc thời gian chuẩn xác)
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

  // 2. Thiết lập bộ lọc (Filter)
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

    if (changed === "start" && startVal > endVal) {
      endVal = startVal;
    }
    if (changed === "end" && endVal < startVal) {
      startVal = endVal;
    }

    const allowedStartMonths = months.filter((m) => m <= endVal);
    const allowedEndMonths = months.filter((m) => m >= startVal);

    populateSelect(startSelect, allowedStartMonths, startVal);
    populateSelect(endSelect, allowedEndMonths, endVal);
  };

  updateSelectRanges();

  // 3. Hàm Render Biểu Đồ
  const renderChart = () => {
    const selectedRegion = regionSelect.property("value");
    let startVal = startSelect.property("value");
    let endVal = endSelect.property("value");

    const filteredData = data.filter((d) => {
      const matchRegion = selectedRegion === "All" || d.region === selectedRegion;
      const matchTime = d.monthStr >= startVal && d.monthStr <= endVal;
      return matchRegion && matchTime;
    });

    const totalRecords = filteredData.length;

    if (totalRecords === 0) {
      d3.select("#highest-weather").text("Không có dữ liệu");
      d3.select("#lowest-weather").text("Không có dữ liệu");
      chartGroup.selectAll("*").remove();
      legendGroup.selectAll("*").remove();
      return;
    }

    // Tính toán Tần suất & Province Max/Min cho từng loại thời tiết
    const weatherStats = Array.from(d3.group(filteredData, d => d.weather), ([weather, records]) => {
      const count = records.length;
      const percentage = (count / totalRecords) * 100;
      
      const provGroup = Array.from(d3.group(records, d => d.location), ([loc, recs]) => ({
        loc, count: recs.length
      })).sort((a, b) => a.count - b.count);

      return {
        weather,
        count,
        percentage,
        minProv: provGroup[0],
        maxProv: provGroup[provGroup.length - 1]
      };
    }).sort((a, b) => b.count - a.count); // Giảm dần

    // Cập nhật Thống kê nổi bật (kèm Ký hiệu)
    const highest = weatherStats[0];
    const lowest = weatherStats[weatherStats.length - 1];

    d3.select("#highest-weather").html(`${getWeatherIcon(highest.weather)} ${highest.weather} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${highest.count} lần - ${highest.percentage.toFixed(1)}%)</span>`);
    d3.select("#lowest-weather").html(`${getWeatherIcon(lowest.weather)} ${lowest.weather} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${lowest.count} lần - ${lowest.percentage.toFixed(1)}%)</span>`);

    // Vẽ Pie Chart
    const pie = d3.pie().value(d => d.count).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius); 
    
    const arcs = chartGroup.selectAll(".arc")
      .data(pie(weatherStats), d => d.data.weather);

    const arcsEnter = arcs.enter().append("g").attr("class", "arc");

    arcsEnter.append("path")
      .attr("class", "arc-path")
      .attr("fill", d => getWeatherColor(d.data.weather)) 
      .attr("d", arc)
      .each(function(d) { this._current = d; }) 
      .on("mouseenter", function(event, d) {
        chartGroup.selectAll(".arc-path").classed("dimmed", true);
        d3.select(this).classed("dimmed", false)
          .transition().duration(200)
          .attr("transform", "scale(1.05)"); 

        let tooltipContent = `
          <strong style="font-size: 15px;">${getWeatherIcon(d.data.weather)} ${d.data.weather}</strong>
          <hr style="margin: 6px 0; border: none; border-top: 1px dashed rgba(15, 23, 42, 0.2);"/>
          Tỷ lệ xuất hiện: <strong>${d.data.percentage.toFixed(2)}%</strong> (${d.data.count} lần)<br/>
          <span style="color: #be123c;">▲ Xuất hiện nhiều nhất:</span> ${d.data.maxProv.loc} (${d.data.maxProv.count} lần)<br/>
          <span style="color: #0369a1;">▼ Xuất hiện ít nhất:</span> ${d.data.minProv.loc} (${d.data.minProv.count} lần)
        `;
        tooltip.style("opacity", 1).html(tooltipContent);
        updateTooltipPosition(event, tooltip);
      })
      .on("mousemove", (event) => updateTooltipPosition(event, tooltip))
      .on("mouseleave", function() {
        chartGroup.selectAll(".arc-path").classed("dimmed", false);
        d3.select(this)
          .transition().duration(200)
          .attr("transform", "scale(1)"); 
        tooltip.style("opacity", 0);
      });

    arcs.select("path").transition().duration(750)
      .attrTween("d", function(d) {
        const i = d3.interpolate(this._current, d);
        this._current = i(1);
        return t => arc(i(t));
      });

    arcs.exit().remove();

    // Vẽ Legend (Chú giải)
    const legend = legendGroup.selectAll(".legend-item")
      .data(weatherStats, d => d.weather);

    const legendEnter = legend.enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 28})`)
      // ==========================================
      // THÊM LOGIC HOVER TỪ CHÚ THÍCH SANG BIỂU ĐỒ
      // ==========================================
      .on("mouseenter", function(event, d) {
        const targetWeather = d.weather;
        
        chartGroup.selectAll(".arc-path")
          .classed("dimmed", p => p.data.weather !== targetWeather)
          .filter(p => p.data.weather === targetWeather)
          .transition().duration(200)
          .attr("transform", "scale(1.05)"); 
      })
      .on("mouseleave", function() {
        chartGroup.selectAll(".arc-path")
          .classed("dimmed", false)
          .transition().duration(200)
          .attr("transform", "scale(1)");
      });

    legendEnter.append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", d => getWeatherColor(d.weather)); 

    legendEnter.append("text")
      .attr("x", 26)
      .attr("y", 13)
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("fill", "#334155")
      .text(d => `${getWeatherIcon(d.weather)} ${d.weather} (${d.percentage.toFixed(1)}%)`); 

    legend.transition().duration(750)
      .attr("transform", (d, i) => `translate(0, ${i * 28})`);
      
    legend.select("text")
      .text(d => `${d.weather} (${d.percentage.toFixed(1)}%)`);

    legend.exit().remove();
  };

  renderChart();

  regionSelect.on("change", renderChart);
  startSelect.on("change", () => {
    updateSelectRanges("start");
    renderChart();
  });
  endSelect.on("change", () => {
    updateSelectRanges("end");
    renderChart();
  });
});