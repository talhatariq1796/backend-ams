import ExcelJS from "exceljs";
import { format, isSameDay, eachDayOfInterval } from "date-fns";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import Teams from "../models/team.model.js";
import Departments from "../models/department.model.js";

export const generateExcel = async (data, reportType, options = {}) => {
  const workbook = new ExcelJS.Workbook();
  let worksheet;

  switch (reportType) {
    case "month_history":
      worksheet = workbook.addWorksheet("Monthly Attendance");
      await generateMonthlyAttendance(worksheet, data, options);
      break;

    case "today":
      worksheet = workbook.addWorksheet("Today's Attendance");
      generateTodaysAttendance(worksheet, data);
      break;

    case "history":
      worksheet = workbook.addWorksheet("Attendance History");
      generateAttendanceHistory(worksheet, data, options);
      break;

    default:
      throw new Error("Invalid report type");
  }

  return workbook.xlsx.writeBuffer();
};

const generateMonthlyAttendance = (worksheet, data, { month, year }) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  const columns = [{ header: "Employee", key: "employee", width: 30 }];

  dates.forEach((date) => {
    const dateHeader = format(date, "d MMM");
    columns.push({
      header: dateHeader,
      key: dateHeader,
      width: 12,
    });
  });

  columns.push(
    { header: "Present", key: "present", width: 10 },
    { header: "Leave", key: "leave", width: 10 },
    { header: "Late", key: "late", width: 10 },
    { header: "Early Leave", key: "early-leave", width: 12 },
    { header: "Remote", key: "remote", width: 10 },
    { header: "Unpaid Leave", key: "unpaid_leave", width: 15 },
    { header: "Public Holiday", key: "public_holiday", width: 15 },
    { header: "Fine", key: "fine", width: 10 }
  );

  worksheet.columns = columns;

  data.forEach((userRecord) => {
    const row = {
      employee: `${userRecord.user.name} (${userRecord.user.employee_id})`,
    };

    dates.forEach((date) => {
      const dateKey = format(date, "d MMM");
      const attendance = userRecord.stats.attendance.find((a) =>
        isSameDay(a.date, date)
      );

      if (attendance) {
        // Handle different status types including new enums
        if (
          [
            "leave",
            "auto-leave",
            "half-day",
            "auto-half-day",
            "holiday",
            "trip",
            "early-leave",
          ].includes(attendance.status)
        ) {
          row[dateKey] =
            attendance.status.charAt(0).toUpperCase() +
            attendance.status.slice(1).replace("-", " ");
        } else if (attendance.check_in) {
          // Validate check_in before formatting
          const checkInDate = new Date(attendance.check_in);
          if (!isNaN(checkInDate.getTime())) {
            row[dateKey] = format(checkInDate, "HH:mm");
          } else {
            console.warn(
              `Invalid check_in date for ${userRecord.user.name} on ${format(
                date,
                "yyyy-MM-dd"
              )}:`,
              attendance.check_in
            );
            row[dateKey] = "Invalid";
          }
        } else {
          // Present but no check_in time (should not happen, but handle gracefully)
          row[dateKey] =
            attendance.status.charAt(0).toUpperCase() +
            attendance.status.slice(1);
        }
      } else {
        row[dateKey] = "";
      }
    });

    row.present = userRecord.stats.present;
    row.leave = userRecord.stats.leave;
    row.late = userRecord.stats.late;
    row["early-leave"] = userRecord.stats.early_leave || 0;
    row.remote = userRecord.stats.remote;
    row.unpaid_leave = userRecord.stats.unpaid_leave || 0;
    row.public_holiday = userRecord.stats.public_holiday;
    row.fine = userRecord.stats.fine;

    worksheet.addRow(row);
  });

  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
  });
};

const generateTodaysAttendance = (worksheet, data) => {
  worksheet.columns = [
    { header: "Employee", key: "employee", width: 25 },
    { header: "Designation", key: "designation", width: 20 },
    { header: "Status", key: "status", width: 12 },
    { header: "Check In", key: "check_in", width: 15 },
    { header: "Check Out", key: "check_out", width: 15 },
    { header: "Productivity", key: "productivity", width: 15 },
  ];

  data.forEach((record) => {
    // Handle weekend case - check_in/check_out might be "Weekend" string
    const checkInValue = record.check_in === "Weekend" 
      ? "Weekend" 
      : record.check_in 
        ? format(new Date(record.check_in), "HH:mm")
        : "-";
    
    const checkOutValue = record.check_out === "Weekend"
      ? "Weekend"
      : record.check_out
        ? format(new Date(record.check_out), "HH:mm")
        : "-";

    worksheet.addRow({
      employee: record.employee,
      designation: record.designation,
      status: record.status.toUpperCase(),
      check_in: checkInValue,
      check_out: checkOutValue,
      productivity: record.productivity,
    });
  });
};

const generateAttendanceHistory = (worksheet, data, options = {}) => {
  worksheet.columns = [
    { header: "Employee ID", key: "employee_id", width: 15 },
    { header: "Employee Name", key: "employee_name", width: 25 },
    { header: "Date", key: "date", width: 12 },
    { header: "Check In", key: "check_in", width: 15 },
    { header: "Check Out", key: "check_out", width: 15 },
    { header: "Productivity", key: "productivity", width: 15 },
    { header: "Status", key: "status", width: 12 },
  ];

  let recordsToProcess = [];

  if (Array.isArray(data)) {
    if (data[0]?.stats?.attendance) {
      data.forEach((userRecord) => {
        userRecord.stats.attendance.forEach((attendanceRecord) => {
          recordsToProcess.push({
            ...attendanceRecord,
            user: userRecord.user,
          });
        });
      });
    } else {
      recordsToProcess = data;
    }
  } else if (data?.stats?.attendance) {
    recordsToProcess = data.stats.attendance.map((record) => ({
      ...record,
      user: data.user,
    }));
  } else {
    recordsToProcess = [data];
  }

  recordsToProcess.forEach((record) => {
    const user = record.user || options.user || {};

    worksheet.addRow({
      employee_id: user.employee_id || user.id || "N/A",
      employee_name:
        user.name ||
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        "N/A",
      date: format(new Date(record.date), "yyyy-MM-dd"),
      check_in: record.check_in
        ? format(new Date(record.check_in), "HH:mm")
        : "-",
      check_out: record.check_out
        ? format(new Date(record.check_out), "HH:mm")
        : "-",
      productivity: record.production_time || record.productivity || "0h 0m",
      status: record.status ? record.status.toUpperCase() : "N/A",
    });
  });

  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
  });
};

export const generatePDF = (data, reportType, options = {}) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      margin: 30,
      size: "A4",
      layout: "portrait",
      bufferPages: true,
    });
    const buffers = [];

    const rowHeight = 30;
    const marginBottom = 40;

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    const table = {
      headers: [
        "Date",
        "Check In",
        "Check Out",
        "Status",
        "Prod. Time",
        "Late",
      ],
      widths: [100, 80, 80, 80, 100, 60],
      positions: [],
    };

    let currentX = 30;
    table.positions = table.widths.map((width) => {
      const pos = currentX;
      currentX += width;
      return pos;
    });

    const formatTime = (date) => {
      if (date === "Weekend" || date === "weekend") return "Weekend";
      return date ? format(new Date(date), "HH:mm") : "-";
    };

    const processRecord = (record) => {
      // Handle weekend case for today's attendance
      const isWeekendRecord = record.status === "weekend" || 
                              record.check_in === "Weekend" || 
                              record.check_out === "Weekend";
      
      return [
        record.date ? format(new Date(record.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        isWeekendRecord ? "Weekend" : formatTime(record.check_in),
        isWeekendRecord ? "Weekend" : formatTime(record.check_out),
        record.status?.toUpperCase() || "N/A",
        isWeekendRecord ? "Weekend" : (record.production_time || record.productivity || "0h 0m"),
        isWeekendRecord ? "Weekend" : (record.is_late ? "Yes" : "No"),
      ];
    };

    const drawEmployeeInfo = (user) => {
      if (!user) {
        console.warn("⚠️ No user data provided for employee info");
        return;
      }

      doc.fillColor("#2E86C1").fontSize(16).font("Helvetica-Bold");
      doc.text("EMPLOYEE ATTENDANCE REPORT", { align: "center" });

      doc.moveDown(0.5);
      doc.fillColor("#000000").fontSize(10).font("Helvetica");
      doc.text(`Generated on: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, {
        align: "right",
      });

      doc.moveDown(1);

      const infoBoxX = 30;
      const infoBoxY = doc.y;
      const infoBoxWidth = 300;
      const infoBoxHeight = 110;

      doc.save();
      doc
        .fillColor("#F8F9FA")
        .rect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight)
        .fill();

      doc
        .fillColor("#E9ECEF")
        .rect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight)
        .stroke();
      doc.restore();

      doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold");
      doc.text("EMPLOYEE INFORMATION", infoBoxX + 10, infoBoxY + 10);

      doc.fontSize(10).font("Helvetica");
      const employeeName =
        user.name ||
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        "N/A";
      const employeeId = user.employee_id || user.id || "N/A";
      const designation = user.designation || "N/A";
      const department = user.department_name || "Not Assigned";
      const team = user.team_name || "Not Assigned";

      doc
        .font("Helvetica-Bold")
        .text("Name:", infoBoxX + 10, infoBoxY + 30, { continued: true });
      doc.font("Helvetica").text(` ${employeeName}`);

      doc
        .font("Helvetica-Bold")
        .text("Employee ID:", infoBoxX + 10, infoBoxY + 45, {
          continued: true,
        });
      doc.font("Helvetica").text(` ${employeeId}`);

      doc
        .font("Helvetica-Bold")
        .text("Designation:", infoBoxX + 10, infoBoxY + 60, {
          continued: true,
        });
      doc.font("Helvetica").text(` ${designation}`);

      doc
        .font("Helvetica-Bold")
        .text("Department:", infoBoxX + 10, infoBoxY + 75, { continued: true });
      doc.font("Helvetica").text(` ${department}`);

      doc
        .font("Helvetica-Bold")
        .text("Team:", infoBoxX + 10, infoBoxY + 90, { continued: true });
      doc.font("Helvetica").text(` ${team}`);

      doc.y = infoBoxY + infoBoxHeight + 20;
    };

    const drawTableHeader = () => {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF");

      doc.save();
      doc
        .fillColor("#2E86C1")
        .rect(30, y, doc.page.width - 60, rowHeight)
        .fill();
      doc.restore();

      table.headers.forEach((header, i) => {
        doc.fillColor("#FFFFFF").text(header, table.positions[i], y + 8, {
          width: table.widths[i],
          align: "center",
        });
      });
      doc.y = y + rowHeight;
    };

    const addRows = (records) => {
      doc.font("Helvetica").fontSize(9);
      records.forEach((record, index) => {
        let rowTop = doc.y;
        if (rowTop + rowHeight > doc.page.height - marginBottom) {
          if (index !== records.length - 1) {
            doc.addPage();
            drawTableHeader();
            rowTop = doc.y;
          }
        }

        if (index % 2 === 1) {
          doc
            .save()
            .fillColor("#F2F3F4")
            .rect(30, rowTop, doc.page.width - 60, rowHeight)
            .fill()
            .restore();
        }

        const row = processRecord(record);
        row.forEach((cell, i) => {
          doc
            .font("Helvetica")
            .fillColor("#000000")
            .text(cell, table.positions[i], rowTop + 8, {
              width: table.widths[i],
              align: "center",
              lineBreak: true,
              height: rowHeight - 16,
            });
        });

        doc.y = rowTop + rowHeight;
      });
    };

    let userInfo = null;
    let attendanceRecords = [];

    // Handle "today" report type differently
    if (reportType === "today" && Array.isArray(data) && data.length > 0) {
      // For today's report, data is array of {employee, status, check_in, check_out, productivity}
      // If search is applied, there should be only one employee
      const firstRecord = data[0];
      const today = new Date();
      
      // Extract employee name from the record
      const employeeNameParts = firstRecord.employee?.split(" ") || [];
      userInfo = {
        name: firstRecord.employee || "Employee",
        first_name: employeeNameParts[0] || "",
        last_name: employeeNameParts.slice(1).join(" ") || "",
        employee_id: firstRecord.employee_id || "N/A",
        designation: firstRecord.designation || "N/A",
      };

      // Convert today's attendance data to the format expected by processRecord
      attendanceRecords = data.map((record) => ({
        date: today,
        check_in: record.check_in,
        check_out: record.check_out,
        status: record.status,
        production_time: record.productivity,
        productivity: record.productivity,
        is_late: false, // Today's report doesn't track late status
      }));
    } else if (Array.isArray(data)) {
      if (data[0]?.stats?.attendance) {
        userInfo = data[0].user;

        data.forEach((userRecord, index) => {
          userRecord.stats.attendance.forEach((record) => {
            attendanceRecords.push({
              ...record,
              user: userRecord.user,
            });
          });
        });
      } else {
        attendanceRecords = data;
        userInfo = data[0]?.user || options.user;
      }
    } else if (data?.stats?.attendance) {
      userInfo = data.user;
      attendanceRecords = data.stats.attendance;
    } else {
      attendanceRecords = [data];
      userInfo = data.user || options.user;
    }
    const logoPath = path.resolve("assets/images/logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, doc.page.width / 2 - 60, 20, {
          width: 120,
        });
        doc.moveDown(2); // Optional: pushes content down after logo
      } catch (e) {
        console.warn("⚠️ Failed to load logo:", e.message);
      }
    }

    drawEmployeeInfo(userInfo);
    drawTableHeader();
    addRows(attendanceRecords);

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor("#666666")
        .text(
          `Page ${i + 1} of ${pageCount}`,
          doc.page.width - 80,
          doc.page.height - 20,
          { align: "right" }
        );
    }

    doc.end();
  });
};
