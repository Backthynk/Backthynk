# Dockerfile for local multi-platform builds
# Mirrors the GitHub Actions release workflow environment

FROM ubuntu:24.04

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    jq \
    gzip \
    brotli \
    sed \
    gawk \
    coreutils \
    findutils \
    rsync \
    gcc-aarch64-linux-gnu \
    gcc-mingw-w64-x86-64 \
    zip \
    unzip \
    xz-utils \
    clang \
    llvm \
    lld \
    libxml2-dev \
    libssl-dev \
    libbz2-dev \
    zlib1g-dev \
    make \
    cmake \
    patch \
    && rm -rf /var/lib/apt/lists/*

# Install osxcross for macOS cross-compilation
RUN git clone https://github.com/tpoechtrager/osxcross.git /opt/osxcross && \
    cd /opt/osxcross && \
    wget -nc https://github.com/joseluisq/macosx-sdks/releases/download/15.5/MacOSX15.5.sdk.tar.xz -O tarballs/MacOSX15.5.sdk.tar.xz && \
    UNATTENDED=1 ./build.sh && \
    rm -rf /opt/osxcross/tarballs /opt/osxcross/build

# Install Go 1.25
RUN curl -L https://go.dev/dl/go1.25.0.linux-amd64.tar.gz | tar -C /usr/local -xzf - && \
    ln -s /usr/local/go/bin/go /usr/local/bin/go && \
    ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt

# Install Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Go-based minifier
RUN go install github.com/tdewolff/minify/v2/cmd/minify@latest && \
    ln -s /root/go/bin/minify /usr/local/bin/minify

# Install Node.js CSS optimization tools
RUN npm install -g csso-cli

# Add osxcross to PATH
ENV PATH="/opt/osxcross/target/bin:${PATH}"

# Set working directory
WORKDIR /workspace

# Default command
CMD ["/bin/bash"]
