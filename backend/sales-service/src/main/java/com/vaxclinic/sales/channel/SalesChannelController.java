package com.vaxclinic.sales.channel;

import com.vaxclinic.sales.channel.SalesChannelService.ChannelRequest;
import com.vaxclinic.sales.common.Actor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Kênh bán: xem (bán hàng / báo cáo / thiết lập), thêm / sửa / xóa (settings.manage). DIRECT không xóa / tắt được. */
@RestController
@RequestMapping("/api/sales-channels")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view') or hasAuthority('settings.manage')")
public class SalesChannelController {

    private final SalesChannels channels;
    private final SalesChannelService service;

    public SalesChannelController(SalesChannels channels, SalesChannelService service) {
        this.channels = channels;
        this.service = service;
    }

    @GetMapping
    public List<SalesChannels.Channel> list(@RequestParam(defaultValue = "false") boolean all) {
        return channels.list(all);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('settings.manage')")
    public SalesChannels.Channel create(@Valid @RequestBody ChannelRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    @PutMapping("/{code}")
    @PreAuthorize("hasAuthority('settings.manage')")
    public SalesChannels.Channel update(@PathVariable String code, @Valid @RequestBody ChannelRequest req,
                                        @AuthenticationPrincipal Jwt jwt) {
        return service.update(code, req, Actor.of(jwt));
    }

    /** Kênh đã có hóa đơn / đơn đặt hàng thì không xóa được — chuyển sang ngừng hoạt động. */
    @DeleteMapping("/{code}")
    @PreAuthorize("hasAuthority('settings.manage')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String code, @AuthenticationPrincipal Jwt jwt) {
        service.delete(code, Actor.of(jwt));
    }
}
