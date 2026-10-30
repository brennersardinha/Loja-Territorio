export function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 1280;
        const widthRatio = maxSize / image.width;
        const heightRatio = maxSize / image.height;
        const scale = Math.min(1, widthRatio, heightRatio);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Não foi possível processar a imagem selecionada.'));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.86));
      };

      image.onerror = () => reject(new Error('Não foi possível processar a imagem selecionada.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });
}

export function handleProductPhotosChange(event, setProductForm) {
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));

  setProductForm((current) => ({
    ...current,
    fotos_produto_files: files,
  }));
}
