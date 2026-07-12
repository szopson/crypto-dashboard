"""Unit tests for the /api/region IP-extraction and gating policy."""
import ipaddress

import pytest

from api import region as region_mod
from api.region import extract_client_ip, region_for_ip


class TestExtractClientIp:
    def test_missing_header(self):
        ip, reason = extract_client_ip(None)
        assert ip is None and reason == "no_forwarded_header"

    def test_empty_header(self):
        ip, reason = extract_client_ip("  , ")
        assert ip is None and reason == "empty_forwarded_header"

    def test_single_public_ipv4(self):
        ip, reason = extract_client_ip("8.8.8.8")
        assert str(ip) == "8.8.8.8" and reason == "ok"

    def test_whitespace_tolerated(self):
        ip, _ = extract_client_ip("  8.8.8.8  ")
        assert str(ip) == "8.8.8.8"

    def test_single_public_ipv6(self):
        ip, reason = extract_client_ip("2001:4860:4860::8888")
        assert reason == "ok" and isinstance(ip, ipaddress.IPv6Address)

    def test_ipv4_mapped_ipv6_unwrapped(self):
        ip, reason = extract_client_ip("::ffff:8.8.8.8")
        assert reason == "ok" and str(ip) == "8.8.8.8"

    def test_private_ip_rejected(self):
        for addr in ["10.0.0.1", "192.168.1.5", "172.16.0.1", "127.0.0.1", "::1", "fe80::1"]:
            ip, reason = extract_client_ip(addr)
            assert ip is None and reason == "non_public_ip", addr

    def test_unparseable_rejected(self):
        ip, reason = extract_client_ip("not-an-ip")
        assert ip is None and reason == "unparseable_entry"

    def test_spoofed_multi_public_hops_rejected(self):
        # Traefik sets exactly one entry; two public hops = header-trust
        # misconfiguration or spoofing → fail closed.
        ip, reason = extract_client_ip("1.2.3.4, 8.8.8.8")
        assert ip is None and reason == "multiple_public_hops"

    def test_private_then_public_takes_rightmost(self):
        # A client behind NAT that legitimately sent its own private XFF.
        ip, reason = extract_client_ip("192.168.1.5, 8.8.8.8")
        assert str(ip) == "8.8.8.8" and reason == "ok"

    def test_public_then_private_rejected(self):
        # Rightmost (Traefik-appended) is private → misrouted/misconfigured.
        ip, reason = extract_client_ip("8.8.8.8, 10.0.0.1")
        assert ip is None and reason == "non_public_ip"


class _FakeCountry:
    def __init__(self, iso_code):
        self.country = self
        self.iso_code = iso_code


class _FakeReader:
    def __init__(self, iso_code):
        self._iso = iso_code

    def country(self, ip):
        return _FakeCountry(self._iso)


class TestRegionForIp:
    @pytest.fixture(autouse=True)
    def _restricted_us(self, monkeypatch):
        monkeypatch.setattr(
            type(region_mod.settings), "restricted_regions_set", {"US"}, raising=False
        )

    def test_restricted_country_returned(self, monkeypatch):
        monkeypatch.setattr(region_mod, "_get_reader", lambda: _FakeReader("US"))
        assert region_for_ip("8.8.8.8") == ("US", True)

    def test_lowercase_normalized(self, monkeypatch):
        monkeypatch.setattr(region_mod, "_get_reader", lambda: _FakeReader("us"))
        assert region_for_ip("8.8.8.8") == ("US", True)

    def test_unrestricted_country_is_verified_null(self, monkeypatch):
        # GeoLite EULA hygiene: never expose codes outside the restricted set —
        # but resolved=True lets the frontend show all venues.
        monkeypatch.setattr(region_mod, "_get_reader", lambda: _FakeReader("PL"))
        assert region_for_ip("8.8.8.8") == (None, True)

    def test_missing_db_is_unresolved(self, monkeypatch):
        monkeypatch.setattr(region_mod, "_get_reader", lambda: None)
        assert region_for_ip("8.8.8.8") == (None, False)

    def test_no_country_is_unresolved(self, monkeypatch):
        monkeypatch.setattr(region_mod, "_get_reader", lambda: _FakeReader(None))
        assert region_for_ip("8.8.8.8") == (None, False)
