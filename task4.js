const normalizeName = (name) => {
  if (!name) return "";
  return name.toLowerCase().replace(/(tỉnh|thành phố|tp\.)/g, '').trim();
};

const parseNumber = (value) => {
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
};

// Hàm định dạng hiển thị thời gian từ YYYY-MM sang MM-YYYY
const formatMonthDisplay = (str) => {
  if (!str) return "--";
  const parts = str.split("-");
  if (parts.length === 2) {
    return `${parts[1]}-${parts[0]}`;
  }
  return str;
};

const updateTooltipPosition = (event, tooltipElement) => {
  const node = tooltipElement.node();
  const tooltipWidth = node.offsetWidth || 250;
  const tooltipHeight = node.offsetHeight || 150;

  let x = event.pageX;
  let y = event.pageY;

  // Adjust if tooltip goes off-screen
  if (x + tooltipWidth > window.innerWidth - 10) x = window.innerWidth - tooltipWidth - 10;
  if (y + tooltipHeight > window.innerHeight - 10) y = window.innerHeight - tooltipHeight - 10;
  if (x < 10) x = 10;
  if (y < 10) y = 10;

  tooltipElement.style("left", `${x}px`).style("top", `${y}px`);
};

const svg = d3.select("#chart4");
const width = 1000;
const height = 700;
svg.attr("viewBox", `0 0 ${width} ${height}`);

const tooltip = d3.select("#tooltip");

// PHÂN CHIA LAYER TỪ DƯỚI LÊN TRÊN
// Lưới tọa độ -> Bản đồ -> Trục số -> Chú giải (Legend)
const graticuleGroup = svg.append("g").attr("class", "graticule-layer");
const mapGroup = svg.append("g").attr("class", "map-layer");
const axisGroup = svg.append("g").attr("class", "axis-layer");

// Dời thang màu lên góc phải trên (x: width - 100, y: 40)
const legendGroup = svg.append("g").attr("transform", `translate(${width - 100}, 40)`);

let activeProvince = null;

Promise.all([
  d3.csv("df_weather_fixed_utf8.csv"),
  d3.json("vn.json")
]).then(([csvData, geoData]) => {

  const data = csvData
    .map((row) => {
      const dateObj = new Date(row["Date"]);
      return {
        dateObj: dateObj,
        // GIỮ NGUYÊN dạng YYYY-MM để D3.js tính toán & lọc chính xác
        monthStr: dateObj.getFullYear() + "-" + String(dateObj.getMonth() + 1).padStart(2, '0'),
        location: row["Location.Name"],
        normLocation: normalizeName(row["Location.Name"]),
        avgTemp: parseNumber(row["Day.Avgtemp C"]),
        maxTemp: parseNumber(row["Day.Maxtemp C"]),
        minTemp: parseNumber(row["Day.Mintemp C"])
      };
    })
    .filter((row) => row.location && !isNaN(row.avgTemp));

  // Tạo danh sách tháng cho 2 bộ lọc
  const months = Array.from(new Set(data.map((d) => d.monthStr))).sort();
  const startSelect = d3.select("#start-month");
  const endSelect = d3.select("#end-month");

  const populateSelect = (selectElement, values, selectedValue) => {
    selectElement.selectAll("option").remove();
    values.forEach((m) => {
      // Giá trị value giữ nguyên YYYY-MM, nhưng text hiển thị ra là MM-YYYY
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

  const projection = d3.geoMercator().fitSize([width, height], geoData);
  const path = d3.geoPath().projection(projection);

  // ==========================================
  // THÊM TRỤC VÀ LƯỚI KINH ĐỘ / VĨ ĐỘ (GRATICULE & AXES)
  // ==========================================
  
  // 1. Tạo và vẽ lưới kinh vĩ độ ẩn dưới bản đồ
  const graticule = d3.geoGraticule()
    .extent([[100, 8], [112, 24]]) 
    .step([1, 1]);                

  graticuleGroup.append("path")
    .datum(graticule)
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#cbd5e1")
    .attr("stroke-width", 0.6)
    .attr("stroke-dasharray", "4,4")
    .attr("pointer-events", "none");

  // Định nghĩa các mốc kinh độ và vĩ độ chính để đánh nhãn trục
  const longitudes = [102, 104, 106, 108, 110, 112];
  const latitudes = [10, 12, 14, 16, 18, 20, 22];
  const graticuleExtent = { minLon: 100, maxLon: 112, minLat: 8, maxLat: 24 };
  const xAxisY = projection([106, graticuleExtent.minLat])[1];
  const yAxisX = projection([graticuleExtent.minLon, 16])[0];

  // 2. Vẽ Trục Kinh độ (X-Axis - đặt ở cạnh đáy bản đồ)
  longitudes.forEach(lon => {
    const x = projection([lon, graticuleExtent.minLat])[0];
    if (x >= 40 && x <= width - 40) {
      axisGroup.append("line")
        .attr("x1", x).attr("y1", xAxisY - 5)
        .attr("x2", x).attr("y2", xAxisY)
        .attr("stroke", "#64748b")
        .attr("stroke-width", 1.2);

      axisGroup.append("text")
        .attr("x", x)
        .attr("y", xAxisY + 12)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#475569")
        .style("stroke", "#ffffff")
        .style("stroke-width", "3px")
        .style("paint-order", "stroke fill")
        .text(`${lon}°Đ`);
    }
  });

  // 3. Vẽ Trục Vĩ độ (Y-Axis - đặt ở cạnh trái bản đồ)
  latitudes.forEach(lat => {
    const y = projection([graticuleExtent.minLon, lat])[1];
    if (y >= 30 && y <= height - 30) {
      axisGroup.append("line")
        .attr("x1", yAxisX).attr("y1", y)
        .attr("x2", yAxisX + 5).attr("y2", y)
        .attr("stroke", "#64748b")
        .attr("stroke-width", 1.2);

      axisGroup.append("text")
        .attr("x", yAxisX - 8)
        .attr("y", y)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#475569")
        .style("stroke", "#ffffff")
        .style("stroke-width", "3px")
        .style("paint-order", "stroke fill")
        .text(`${lat}°B`);
    }
  });
  // ==========================================

  // Thang màu
  const defs = svg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "temp-gradient")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  const legendHeight = 150;
  const legendWidth = 15;

  legendGroup.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#temp-gradient)");

  legendGroup.append("text")
    .attr("class", "legend-title")
    .attr("x", -10)
    .attr("y", -10)
    .text("Nhiệt độ (°C)");

  const legendAxisGroup = legendGroup.append("g")
    .attr("transform", `translate(${legendWidth}, 0)`);

  svg.on("click", (event) => {
    if (event.target.tagName !== "path") {
      activeProvince = null;
      mapGroup.selectAll(".province-path").classed("dimmed", false);
    }
  });

  const renderMap = () => {
    let startVal = startSelect.property("value");
    let endVal = endSelect.property("value");

    // Đổi lại vị trí nếu người dùng chọn Start lớn hơn End
    if (startVal > endVal) {
      const temp = startVal;
      startVal = endVal;
      endVal = temp;
    }

    // Lọc dữ liệu trong khoảng
    const filteredData = data.filter((d) => d.monthStr >= startVal && d.monthStr <= endVal);

    const groupedByLocation = d3.rollups(
      filteredData,
      (v) => ({
        avgTemp: d3.mean(v, d => d.avgTemp),
        maxTemp: d3.max(v, d => d.maxTemp),
        minTemp: d3.min(v, d => d.minTemp),
        locationName: v[0].location
      }),
      (d) => d.normLocation
    );

    const locationMap = new Map(groupedByLocation);

    if (groupedByLocation.length === 0) {
      d3.select("#highest-temp").text("Không có dữ liệu");
      d3.select("#lowest-temp").text("Không có dữ liệu");
      mapGroup.selectAll("path").attr("fill", "#e2e8f0");
      return;
    }

    let highest = groupedByLocation.reduce((prev, current) => (prev[1].avgTemp > current[1].avgTemp) ? prev : current);
    let lowest = groupedByLocation.reduce((prev, current) => (prev[1].avgTemp < current[1].avgTemp) ? prev : current);

    d3.select("#highest-temp").html(`${highest[1].locationName} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${highest[1].avgTemp.toFixed(1)}°C)</span>`);
    d3.select("#lowest-temp").html(`${lowest[1].locationName} <span style="font-weight:normal; font-size:15px; color:#64748b;">(${lowest[1].avgTemp.toFixed(1)}°C)</span>`);

    const minAvg = d3.min(groupedByLocation, d => d[1].avgTemp);
    const maxAvg = d3.max(groupedByLocation, d => d[1].avgTemp);
    
    const colorScale = d3.scaleSequential(t => d3.interpolateRdYlBu(1 - t))
      .domain([minAvg, maxAvg]);

    linearGradient.selectAll("stop").remove();
    linearGradient.selectAll("stop")
      .data(d3.ticks(0, 1, 10))
      .enter().append("stop")
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d => colorScale(minAvg + d * (maxAvg - minAvg)));

    const legendScale = d3.scaleLinear()
      .domain([minAvg, maxAvg])
      .range([legendHeight, 0]);
    const legendAxis = d3.axisRight(legendScale).ticks(5).tickFormat(d => `${Math.round(d)}°C`);
    legendAxisGroup.transition().duration(500).call(legendAxis);

    mapGroup.selectAll("path")
      .data(geoData.features)
      .join("path")
      .attr("d", path)
      .attr("class", "province-path")
      .attr("fill", (d) => {
        const geoName = d.properties.name || d.properties.Name || d.properties.ten_tinh || "";
        const normGeoName = normalizeName(geoName);
        const provinceData = locationMap.get(normGeoName);
        return provinceData ? colorScale(provinceData.avgTemp) : "#e2e8f0"; 
      })
      .on("mouseenter", function (event, d) {
        const geoName = d.properties.name || d.properties.Name || d.properties.ten_tinh || "Không rõ";
        const normGeoName = normalizeName(geoName);
        const pData = locationMap.get(normGeoName);

        d3.select(this).style("stroke", "#0f172a").style("stroke-width", "2px");

        let tooltipContent = `<strong>${pData ? pData.locationName : geoName}</strong>`;
        if (pData) {
          tooltipContent += `
            <hr style="margin: 6px 0; border: none; border-top: 1px dashed rgba(15, 23, 42, 0.2);"/>
            Nhiệt độ TB: <strong>${pData.avgTemp.toFixed(2)}°C</strong><br>
            <span style="color: #be123c;">▲ Cao nhất:</span> ${pData.maxTemp.toFixed(2)}°C<br>
            <span style="color: #0369a1;">▼ Thấp nhất:</span> ${pData.minTemp.toFixed(2)}°C
          `;
        } else {
          tooltipContent += `<br/><em>Không có dữ liệu</em>`;
        }

        tooltip.style("opacity", 1).html(tooltipContent);
        
        updateTooltipPosition(event, tooltip);
      })
      .on("mousemove", (event) => updateTooltipPosition(event, tooltip))
      .on("mouseleave", function () {
        d3.select(this).style("stroke", null).style("stroke-width", null);
        tooltip.style("opacity", 0);
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        const geoName = d.properties.name || d.properties.Name || d.properties.ten_tinh || "";
        
        if (activeProvince === geoName) {
          activeProvince = null;
          mapGroup.selectAll(".province-path").classed("dimmed", false);
        } else {
          activeProvince = geoName;
          mapGroup.selectAll(".province-path")
            .classed("dimmed", pathData => {
              const pathName = pathData.properties.name || pathData.properties.Name || pathData.properties.ten_tinh || "";
              return pathName !== activeProvince;
            });
        }
      });
  };

  renderMap();

  startSelect.on("change", () => {
    updateSelectRanges("start");
    renderMap();
  });

  endSelect.on("change", () => {
    updateSelectRanges("end");
    renderMap();
  });
});