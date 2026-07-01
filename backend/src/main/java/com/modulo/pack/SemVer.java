package com.modulo.pack;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal semantic-version utility (#276). Parses and compares "MAJOR.MINOR.PATCH" strings.
 */
public final class SemVer implements Comparable<SemVer> {

    private static final Pattern PATTERN = Pattern.compile("^(\\d+)\\.(\\d+)\\.(\\d+)$");

    public static final String CATALOG_VERSION = "1.0.0";

    private final int major;
    private final int minor;
    private final int patch;
    private final String raw;

    private SemVer(int major, int minor, int patch, String raw) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
        this.raw = raw;
    }

    /**
     * Parse a semver string. Returns null if the string is not a valid semver.
     */
    public static SemVer parse(String v) {
        if (v == null) return null;
        Matcher m = PATTERN.matcher(v.trim());
        if (!m.matches()) return null;
        return new SemVer(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)), v.trim());
    }

    /**
     * Parse a semver string, throwing {@link IllegalArgumentException} if invalid.
     */
    public static SemVer parseOrThrow(String v) {
        SemVer result = parse(v);
        if (result == null) {
            throw new IllegalArgumentException("Not a valid semver: \"" + v + "\" (expected MAJOR.MINOR.PATCH)");
        }
        return result;
    }

    /** Returns true if {@code this >= min}. */
    public boolean satisfiesMin(SemVer min) {
        return compareTo(min) >= 0;
    }

    @Override
    public int compareTo(SemVer other) {
        if (this.major != other.major) return Integer.compare(this.major, other.major);
        if (this.minor != other.minor) return Integer.compare(this.minor, other.minor);
        return Integer.compare(this.patch, other.patch);
    }

    public int getMajor() { return major; }
    public int getMinor() { return minor; }
    public int getPatch() { return patch; }

    @Override
    public String toString() { return raw; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof SemVer)) return false;
        return compareTo((SemVer) o) == 0;
    }

    @Override
    public int hashCode() {
        return 31 * 31 * major + 31 * minor + patch;
    }
}
