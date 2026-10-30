package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.common.error.BusinessException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** XML mẫu dựng theo cấu trúc chuẩn TCT, số liệu theo hóa đơn đầu vào 712 của khách (NCC Ngọc Bích, 9,463,452). */
class EInvoiceXmlParserTest {

    private static final String SAMPLE = """
            <?xml version="1.0" encoding="UTF-8"?>
            <HDon><DLHDon Id="data">
              <TTChung><PBan>2.0.1</PBan><THDon>Hóa đơn giá trị gia tăng</THDon><KHMSHDon>1</KHMSHDon>
                <KHHDon>C26TNB</KHHDon><SHDon>712</SHDon><NLap>2026-10-16</NLap><DVTTe>VND</DVTTe></TTChung>
              <NDHDon>
                <NBan><Ten>CÔNG TY TNHH VẮC XIN NGỌC BÍCH</Ten><MST>2500720786</MST><DChi>Vĩnh Phúc</DChi></NBan>
                <NMua><Ten>VACXIN SỐ 1 YÊN LẠC</Ten><MST>026062001722</MST></NMua>
                <DSHHDVu>
                  <HHDVu><TChat>1</TChat><STT>1</STT><MHHDVu>VX01</MHHDVu><THHDVu>Vắc xin Thủy đậu Barycela</THHDVu>
                    <DVTinh>Liều</DVTinh><SLuong>10</SLuong><DGia>685714</DGia><ThTien>6857140</ThTien><TSuat>5%</TSuat></HHDVu>
                  <HHDVu><TChat>1</TChat><STT>2</STT><THHDVu>Vắc xin MMR</THHDVu><DVTinh>Liều</DVTinh>
                    <SLuong>10</SLuong><DGia>166667</DGia><ThTien>1666670</ThTien><TSuat>5%</TSuat></HHDVu>
                </DSHHDVu>
                <TToan><TgTCThue>9012810</TgTCThue><TgTThue>450642</TgTThue><TgTTTBSo>9463452</TgTTTBSo></TToan>
              </NDHDon>
            </DLHDon></HDon>""";

    @Test
    void parsesHeaderPartiesTotalsAndLines() {
        var p = EInvoiceXmlParser.parse(SAMPLE.getBytes(StandardCharsets.UTF_8));
        assertThat(p.series()).isEqualTo("C26TNB");
        assertThat(p.number()).isEqualTo("712");
        assertThat(p.issuedAt()).hasToString("2026-10-16");
        assertThat(p.sellerTaxCode()).isEqualTo("2500720786");
        assertThat(p.sellerName()).isEqualTo("CÔNG TY TNHH VẮC XIN NGỌC BÍCH");
        assertThat(p.buyerTaxCode()).isEqualTo("026062001722");
        assertThat(p.total()).isEqualByComparingTo("9463452");
        assertThat(p.vatAmount()).isEqualByComparingTo("450642");
        assertThat(p.nature()).isEqualTo("ORIGINAL");
        assertThat(p.lines()).hasSize(2);
        assertThat(p.lines().get(0).name()).isEqualTo("Vắc xin Thủy đậu Barycela");
        assertThat(p.lines().get(0).quantity()).isEqualByComparingTo("10");
        assertThat(p.lines().get(1).code()).isNull();
        assertThat(p.lines().get(0).nature()).isEqualTo("1");
        assertThat(p.details().invoiceName()).isEqualTo("Hóa đơn giá trị gia tăng");
        assertThat(p.details().buyerName()).isEqualTo("VACXIN SỐ 1 YÊN LẠC");
        assertThat(p.details().sellerPhone()).isNull();
    }

    @Test
    void rejectsXxePayload() {
        String evil = "<?xml version=\"1.0\"?><!DOCTYPE x [<!ENTITY e SYSTEM \"file:///etc/passwd\">]><HDon>&e;</HDon>";
        assertThatThrownBy(() -> EInvoiceXmlParser.parse(evil.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void rejectsNonInvoiceXml() {
        assertThatThrownBy(() -> EInvoiceXmlParser.parse("<root><a>1</a></root>".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(BusinessException.class);
    }
}
