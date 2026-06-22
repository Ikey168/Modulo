package com.modulo.pack;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class SemVerTest {

    @Test
    void parse_validString_returnsInstance() {
        SemVer v = SemVer.parse("1.2.3");
        assertThat(v).isNotNull();
        assertThat(v.getMajor()).isEqualTo(1);
        assertThat(v.getMinor()).isEqualTo(2);
        assertThat(v.getPatch()).isEqualTo(3);
        assertThat(v.toString()).isEqualTo("1.2.3");
    }

    @Test
    void parse_invalidStrings_returnsNull() {
        assertThat(SemVer.parse(null)).isNull();
        assertThat(SemVer.parse("")).isNull();
        assertThat(SemVer.parse("1.2")).isNull();
        assertThat(SemVer.parse("1.2.3.4")).isNull();
        assertThat(SemVer.parse("a.b.c")).isNull();
    }

    @Test
    void parseOrThrow_invalidString_throws() {
        assertThatThrownBy(() -> SemVer.parseOrThrow("bad"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void compareTo_ordersCorrectly() {
        SemVer v1 = SemVer.parseOrThrow("1.0.0");
        SemVer v2 = SemVer.parseOrThrow("1.0.1");
        SemVer v3 = SemVer.parseOrThrow("2.0.0");
        SemVer same = SemVer.parseOrThrow("1.0.0");

        assertThat(v1.compareTo(v2)).isNegative();
        assertThat(v2.compareTo(v1)).isPositive();
        assertThat(v1.compareTo(same)).isZero();
        assertThat(v1.compareTo(v3)).isNegative();
    }

    @Test
    void satisfiesMin_returnsCorrectly() {
        SemVer v = SemVer.parseOrThrow("2.0.0");
        assertThat(v.satisfiesMin(SemVer.parseOrThrow("1.9.9"))).isTrue();
        assertThat(v.satisfiesMin(SemVer.parseOrThrow("2.0.0"))).isTrue();
        assertThat(v.satisfiesMin(SemVer.parseOrThrow("2.0.1"))).isFalse();
    }

    @Test
    void equals_andHashCode_consistent() {
        SemVer a = SemVer.parseOrThrow("1.2.3");
        SemVer b = SemVer.parseOrThrow("1.2.3");
        assertThat(a).isEqualTo(b);
        assertThat(a.hashCode()).isEqualTo(b.hashCode());
    }

    @Test
    void catalogVersion_isValidSemVer() {
        assertThat(SemVer.parse(SemVer.CATALOG_VERSION)).isNotNull();
    }
}
