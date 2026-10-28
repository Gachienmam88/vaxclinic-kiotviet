import type { PartyConfig } from "./party-report";

/** Cấu hình Báo cáo khách hàng / nhân viên / kênh bán hàng (dùng chung PartyReport). Chữ hiển thị: text(t) theo ngôn ngữ. */

export const CUSTOMER_REPORT: PartyConfig = {
  page: "bao-cao-khach-hang", groupBy: "CUSTOMER", productsBy: "CUSTOMER", filters: ["customer"],
  text: (t) => ({
    title: t("party.customer.title"), noun: t("party.customer.noun"),
    concerns: [["sales", t("party.customer.concerns.sales")], ["products", t("party.customer.concerns.products")],
      ["debt", t("party.customer.concerns.debt")], ["profit", t("party.customer.concerns.profit")]],
    titles: { sales: t("party.customer.titles.sales"), products: t("party.customer.titles.products"), debt: t("party.customer.titles.debt"),
      profit: t("party.customer.titles.profit") },
    chartTitle: t("party.customer.chartTitle"), firstCol: t("cols.customerName"), codeCol: t("cols.customerCode"),
  }),
};

export const EMPLOYEE_REPORT: PartyConfig = {
  page: "bao-cao-nhan-vien", groupBy: "SELLER", productsBy: "SELLER", filters: ["seller", "channel"],
  text: (t) => ({
    title: t("party.employee.title"), noun: t("party.employee.noun"),
    concerns: [["sales", t("party.employee.concerns.sales")], ["profit", t("party.employee.concerns.profit")],
      ["products", t("party.employee.concerns.products")]],
    titles: { sales: t("party.employee.titles.sales"), profit: t("party.employee.titles.profit"), products: t("party.employee.titles.products") },
    chartTitle: t("party.employee.chartTitle"), firstCol: t("cols.seller"), note: t("party.employee.note"),
  }),
};

export const CHANNEL_REPORT: PartyConfig = {
  page: "bao-cao-kenh-ban", groupBy: "CHANNEL", pie: true, filters: ["seller", "channel"],
  text: (t) => ({
    title: t("party.channel.title"), noun: t("party.channel.noun"),
    concerns: [["sales", t("party.channel.concerns.sales")], ["profit", t("party.channel.concerns.profit")]],
    titles: { sales: t("party.channel.titles.sales"), profit: t("party.channel.titles.profit") },
    chartTitle: t("party.channel.chartTitle"), firstCol: t("cols.channel"), note: t("party.channel.note"),
  }),
};
