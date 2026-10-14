package com.cartlens.ingestion;

public enum Dataset {
    RETAIL("Retail-metadata"), ACCIDENTS("Accidents-metadata");
    private final String directory;
    Dataset(String directory) { this.directory = directory; }
    public String directory() { return directory; }
}
