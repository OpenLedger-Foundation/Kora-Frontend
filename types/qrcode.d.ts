declare module "qrcode" {
  interface QRCodeOptions {
    margin?: number;
    width?: number;
  }

  const QRCode: {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  };

  export default QRCode;
}
