/**
 * Điều khoản sử dụng hệ thống quản lý nội bộ (bản nháp tự soạn, không sao chép điều khoản của bên nào).
 * Đổi nội dung → tăng TERMS_VERSION ở đây VÀ TermsController.CURRENT_VERSION (identity-service): mọi user phải đồng ý lại.
 * Căn cứ pháp lý rà soát ngày 29/10/2026 — xem báo cáo plans/reports/implementer-261029-account-menu-store-profile.md.
 */
export const TERMS_VERSION = "1.0";
export const TERMS_EFFECTIVE_DATE = "01/11/2026";

export type TermsSection = { title: string; paragraphs?: string[]; bullets?: string[] };

export const TERMS_DRAFT_NOTICE = "Bản nháp — cần chuyên gia pháp lý rà soát trước khi áp dụng";

export const TERMS_INTRO =
  "Điều khoản này quy định việc sử dụng hệ thống quản lý nội bộ của doanh nghiệp (quản lý vắc xin, kho, hồ sơ tiêm chủng, " +
  "bán hàng, hóa đơn, nhân sự). Người dùng là nhân viên, cộng tác viên được doanh nghiệp cấp tài khoản. Bằng việc chọn " +
  "\"Tôi đồng ý\", người dùng xác nhận đã đọc, hiểu và cam kết tuân thủ.";

export const TERMS_SECTIONS: TermsSection[] = [
  { title: "1. Phạm vi áp dụng", paragraphs: [
    "Áp dụng cho mọi tài khoản truy cập hệ thống qua trình duyệt, máy bán hàng tại quầy và màn hình chấm công, tại tất cả chi nhánh của doanh nghiệp.",
    "Hệ thống chỉ dùng cho công việc của doanh nghiệp. Không cung cấp cho khách hàng hay bên thứ ba truy cập trực tiếp.",
  ] },
  { title: "2. Tài khoản, mật khẩu và xác thực 2 lớp", bullets: [
    "Mỗi người dùng chỉ dùng tài khoản được cấp cho mình. Không cho mượn, chia sẻ hay dùng chung tài khoản.",
    "Mật khẩu tối thiểu 8 ký tự, không dùng lại mật khẩu của dịch vụ khác. Nghi ngờ lộ mật khẩu phải đổi ngay và báo quản trị viên.",
    "Chủ gian hàng và quản trị viên được khuyến nghị bật xác thực 2 lớp bằng ứng dụng Authenticator. Mã khôi phục phải được cất giữ an toàn, mỗi mã chỉ dùng một lần.",
    "Quyền truy cập được cấp theo vai trò công việc và chi nhánh. Khi đổi vị trí hoặc nghỉ việc, quản trị viên khóa hoặc điều chỉnh quyền ngay.",
    "Mọi thao tác thực hiện bằng tài khoản được coi là do chủ tài khoản thực hiện, trừ khi đã báo mất quyền kiểm soát tài khoản trước đó.",
  ] },
  { title: "3. Quyền và nghĩa vụ của người dùng (nhân viên)", bullets: [
    "Được truy cập đúng các chức năng, dữ liệu cần cho nhiệm vụ được giao; được hướng dẫn sử dụng và được hỗ trợ khi gặp lỗi.",
    "Nhập dữ liệu trung thực, đầy đủ, kịp thời (đặc biệt là khám sàng lọc, lô vắc xin, hạn dùng, phản ứng sau tiêm, chứng từ thu chi).",
    "Chỉ xem, sao chép, xuất dữ liệu trong phạm vi công việc; không chụp, chép, gửi dữ liệu khách hàng ra ngoài hệ thống khi không có yêu cầu công việc hợp lệ.",
    "Đăng xuất hoặc khóa màn hình khi rời máy; không lưu mật khẩu trên máy dùng chung.",
    "Báo ngay cho quản trị viên khi phát hiện lỗi, dữ liệu sai lệch, truy cập bất thường hoặc nghi ngờ sự cố an ninh.",
  ] },
  { title: "4. Dữ liệu cá nhân, dữ liệu sức khỏe và tiêm chủng", paragraphs: [
    "Doanh nghiệp là bên kiểm soát và xử lý dữ liệu cá nhân của khách hàng, người được tiêm và nhân viên trong hệ thống. Thông tin sức khỏe, tiền sử, kết quả khám sàng lọc và lịch sử tiêm chủng là dữ liệu cá nhân nhạy cảm, được bảo vệ ở mức cao nhất.",
  ], bullets: [
    "Mục đích: khám sàng lọc và thực hiện tiêm chủng an toàn; nhắc lịch tiêm; theo dõi, xử lý phản ứng sau tiêm; quản lý vắc xin theo lô; lập hóa đơn, chứng từ; báo cáo theo yêu cầu của cơ quan y tế; quản lý nhân sự và trả lương.",
    "Căn cứ xử lý: sự đồng ý của chủ thể dữ liệu (hoặc cha mẹ, người giám hộ với trẻ em); thực hiện hợp đồng dịch vụ; nghĩa vụ pháp lý về tiêm chủng, kế toán, thuế, lao động.",
    "Quyền của chủ thể dữ liệu: được biết, đồng ý hoặc rút lại sự đồng ý, xem, chỉnh sửa, yêu cầu xóa, hạn chế xử lý, phản đối xử lý, khiếu nại và yêu cầu bồi thường. Nhân viên tiếp nhận yêu cầu phải chuyển ngay cho người phụ trách bảo vệ dữ liệu để phản hồi trong thời hạn luật định.",
    "Lưu trữ: dữ liệu chỉ được giữ trong thời gian cần cho mục đích xử lý hoặc theo thời hạn pháp luật yêu cầu (hồ sơ tiêm chủng, chứng từ kế toán, hóa đơn). Hết thời hạn, dữ liệu được xóa hoặc hủy theo quy trình có biên bản.",
    "Xóa dữ liệu: yêu cầu xóa được đáp ứng trừ trường hợp pháp luật bắt buộc lưu giữ; khi đó dữ liệu được hạn chế truy cập cho tới hết thời hạn lưu.",
    "Sự cố dữ liệu: người phát hiện báo ngay cho quản trị viên; doanh nghiệp đánh giá, khắc phục và thông báo cho cơ quan chuyên trách bảo vệ dữ liệu cá nhân chậm nhất 72 giờ kể từ khi phát hiện theo luật, đồng thời thông báo cho chủ thể dữ liệu khi cần.",
    "Không chuyển dữ liệu sức khỏe, tiêm chủng cho bên thứ ba ngoài cơ quan nhà nước có thẩm quyền, hệ thống thông tin tiêm chủng quốc gia và các đối tác xử lý đã ký cam kết bảo mật.",
  ] },
  { title: "5. Hóa đơn điện tử và chứng từ", bullets: [
    "Hóa đơn điện tử được lập và phát hành qua nhà cung cấp được kết nối (MISA meInvoice) đúng thời điểm theo quy định về hóa đơn, chứng từ. Không lập hóa đơn khống, không sửa nội dung hóa đơn đã phát hành ngoài quy trình điều chỉnh / thay thế.",
    "Chứng từ kế toán (hóa đơn, phiếu thu, phiếu chi, phiếu nhập, xuất kho...) được lưu trữ tối thiểu 10 năm với chứng từ dùng trực tiếp ghi sổ và lập báo cáo tài chính, tối thiểu 5 năm với chứng từ khác, hoặc lâu hơn nếu pháp luật yêu cầu.",
    "Chữ ký số dùng để ký hóa đơn chỉ do người được ủy quyền quản lý. Hệ thống chỉ lưu chứng thư số công khai, không lưu khóa bí mật.",
  ] },
  { title: "6. Bảo mật và nhật ký thao tác", bullets: [
    "Mật khẩu lưu dạng băm; mật khẩu tài khoản bên thứ ba và khóa xác thực 2 lớp được mã hóa; kết nối qua HTTPS khi triển khai ngoài mạng nội bộ.",
    "Hệ thống ghi nhật ký thao tác (người thực hiện, thời gian, nội dung) để kiểm tra, đối soát và điều tra sự cố. Người dùng không được tìm cách xóa hoặc làm sai lệch nhật ký.",
    "Quản trị viên định kỳ rà soát tài khoản, vai trò và nhật ký truy cập bất thường.",
  ] },
  { title: "7. Sao lưu và phục hồi", bullets: [
    "Cơ sở dữ liệu được sao lưu định kỳ, bản sao lưu được mã hóa hoặc cất giữ ở nơi có kiểm soát truy cập.",
    "Việc phục hồi dữ liệu chỉ do quản trị viên được giao thực hiện, có ghi nhận lý do và thời điểm.",
  ] },
  { title: "8. Hành vi bị cấm", bullets: [
    "Truy cập trái phép tài khoản, dữ liệu, chức năng không được giao; dò quét, tấn công, chèn mã độc hoặc làm gián đoạn hệ thống.",
    "Mua, bán, trao đổi, công khai dữ liệu cá nhân, dữ liệu sức khỏe, tiêm chủng hoặc dữ liệu kinh doanh của doanh nghiệp.",
    "Nhập dữ liệu giả, sửa số liệu tồn kho, hạn dùng, kết quả khám, chứng từ để che giấu sai phạm.",
    "Dùng hệ thống cho mục đích cá nhân hoặc trái pháp luật.",
  ] },
  { title: "9. Xử lý vi phạm", paragraphs: [
    "Tùy mức độ, vi phạm bị xử lý theo nội quy lao động (nhắc nhở, khiển trách, tạm khóa tài khoản, chấm dứt hợp đồng), bồi thường thiệt hại và chuyển cơ quan có thẩm quyền nếu có dấu hiệu vi phạm pháp luật về dữ liệu cá nhân, an ninh mạng hoặc hình sự.",
  ] },
  { title: "10. Thay đổi điều khoản", paragraphs: [
    "Doanh nghiệp có thể cập nhật điều khoản khi thay đổi quy trình hoặc quy định pháp luật. Mỗi phiên bản mới có số phiên bản và ngày hiệu lực; người dùng phải đọc và đồng ý lại ở lần đăng nhập kế tiếp trước khi tiếp tục sử dụng.",
  ] },
  { title: "11. Liên hệ", paragraphs: [
    "Mọi câu hỏi, yêu cầu về tài khoản, dữ liệu cá nhân hoặc sự cố an ninh gửi cho chủ gian hàng / quản trị viên hệ thống (xem Hồ sơ cửa hàng → Thông tin gian hàng) hoặc người phụ trách bảo vệ dữ liệu cá nhân do doanh nghiệp chỉ định.",
  ] },
];

/** Căn cứ pháp lý (hiệu lực tại thời điểm soạn 29/10/2026). */
export const TERMS_LEGAL_BASES: string[] = [
  "Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực từ 01/01/2026).",
  "Nghị định 356/2025/NĐ-CP quy định chi tiết Luật Bảo vệ dữ liệu cá nhân (hiệu lực từ 01/01/2026, thay thế Nghị định 13/2023/NĐ-CP).",
  "Luật Giao dịch điện tử số 20/2023/QH15 (hiệu lực từ 01/7/2024).",
  "Luật An ninh mạng số 116/2025/QH15 (hiệu lực từ 01/7/2026, thay thế Luật An ninh mạng số 24/2018/QH14).",
  "Nghị định 123/2020/NĐ-CP về hóa đơn, chứng từ, được sửa đổi, bổ sung bởi Nghị định 70/2025/NĐ-CP (hiệu lực từ 01/6/2025).",
  "Luật Kế toán số 88/2015/QH13 (sửa đổi bởi Luật số 56/2024/QH15) và Nghị định 174/2016/NĐ-CP về thời hạn lưu trữ tài liệu kế toán.",
  "Luật Phòng bệnh số 114/2025/QH15 (hiệu lực từ 01/7/2026), Nghị định 165/2026/NĐ-CP và Thông tư 13/2026/TT-BYT về hoạt động tiêm chủng (thay thế Nghị định 104/2016/NĐ-CP, Thông tư 34/2018/TT-BYT).",
  "Luật Khám bệnh, chữa bệnh số 15/2023/QH15 về bảo mật và lưu trữ hồ sơ.",
];
