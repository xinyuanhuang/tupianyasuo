const REMOVE_BG_API_KEY = 'YOUR-API-KEY'; // 替换成你的 API key
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
let processHistory = [];

document.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const imageEditor = document.getElementById('imageEditor');
    const cropperImage = document.getElementById('cropperImage');
    const cropPreview = document.getElementById('cropPreview');
    const processBtn = document.getElementById('processBtn');
    const resultsContainer = document.getElementById('resultsContainer');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const qualityInput = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const batchProcessBtn = document.getElementById('batchProcessBtn');

    // 状态变量
    let uploadedFiles = [];
    let processedImages = [];
    let currentFileIndex = -1;
    let cropper = null;

    // 文件上传处理
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => handleFiles(e.target.files));
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#007AFF';
    });
    dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#ddd';
    });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#ddd';
        handleFiles(e.dataTransfer.files);
    });

    // 处理上传的文件
    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert('请只上传图片文件');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = e => {
                uploadedFiles.push({
                    file: file,
                    preview: e.target.result,
                    processed: false
                });
                updateUploadList();
                
                // 如果是第一张图片，自动开始编辑
                if (uploadedFiles.length === 1) {
                    startEditingImage(0);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // 更新上传列表显示
    function updateUploadList() {
        const uploadList = document.getElementById('uploadList');
        uploadList.innerHTML = '';
        
        uploadedFiles.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = `upload-item ${index === currentFileIndex ? 'active' : ''}`;
            div.innerHTML = `
                <img src="${item.preview}" alt="预览">
                <button class="remove-btn" data-index="${index}">×</button>
                ${item.processed ? '<div class="status-badge success">已处理</div>' : ''}
            `;
            
            // 点击图片开始编辑
            div.querySelector('img').addEventListener('click', () => {
                startEditingImage(index);
            });
            
            // 删除图片
            div.querySelector('.remove-btn').addEventListener('click', e => {
                e.stopPropagation();
                uploadedFiles.splice(index, 1);
                if (currentFileIndex === index) {
                    if (uploadedFiles.length > 0) {
                        startEditingImage(0);
                    } else {
                        currentFileIndex = -1;
                        imageEditor.style.display = 'none';
                    }
                }
                updateUploadList();
            });
            
            uploadList.appendChild(div);
        });

        // 显示/隐藏容器和批量处理按钮
        const listContainer = document.querySelector('.upload-list-container');
        listContainer.style.display = uploadedFiles.length ? 'block' : 'none';
        batchProcessBtn.style.display = uploadedFiles.length > 1 ? 'block' : 'none';
    }

    // 开始编辑图片
    function startEditingImage(index) {
        currentFileIndex = index;
        cropperImage.src = uploadedFiles[index].preview;
        imageEditor.style.display = 'grid';
        
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImage, {
            aspectRatio: 1,
            viewMode: 2,
            dragMode: 'move',
            autoCropArea: 1,
            cropBoxResizable: false,
            cropBoxMovable: true,
            responsive: true,
            restore: false,
            center: true,
            preview: cropPreview,
            background: false,
            modal: true,
            ready() {
                cropper.setCropBoxData({
                    width: Math.min(cropper.getContainerData().width, 800),
                    height: Math.min(cropper.getContainerData().height, 800)
                });
                updateQualityPreview();
            }
        });
        
        updateUploadList();
    }

    // 编辑器控制按钮
    document.getElementById('rotateLeft').addEventListener('click', () => cropper.rotate(-90));
    document.getElementById('rotateRight').addEventListener('click', () => cropper.rotate(90));
    document.getElementById('zoomIn').addEventListener('click', () => cropper.zoom(0.1));
    document.getElementById('zoomOut').addEventListener('click', () => cropper.zoom(-0.1));

    // 压缩质量控制
    qualityInput.addEventListener('input', () => {
        updateQualityPreview();
    });

    // 添加实时预览压缩大小的函数
    async function updateQualityPreview() {
        if (!cropper) return;
        
        const quality = qualityInput.value / 100;
        qualityValue.textContent = qualityInput.value + '%';
        
        try {
            // 获取裁剪后的图片
            const croppedCanvas = cropper.getCroppedCanvas({
                width: 800,
                height: 800
            });

            // 压缩图片并获取大小
            const imageBlob = await new Promise(resolve => {
                croppedCanvas.toBlob(resolve, 'image/jpeg', quality);
            });

            // 显示预计大小
            qualityValue.textContent = `${qualityInput.value}% (约 ${formatFileSize(imageBlob.size)})`;
        } catch (error) {
            console.error('预览大小计算失败:', error);
        }
    }

    // 处理当前图片
    processBtn.addEventListener('click', async () => {
        if (!cropper || currentFileIndex === -1) return;
        
        try {
            // 获取裁剪后的图片
            const croppedCanvas = cropper.getCroppedCanvas({
                width: 800,
                height: 800
            });

            // 压缩图片
            const quality = qualityInput.value / 100;
            const imageBlob = await new Promise(resolve => {
                croppedCanvas.toBlob(resolve, 'image/jpeg', quality);
            });

            // 更新状态
            uploadedFiles[currentFileIndex].processed = true;
            updateUploadList();

            // 显示处理结果
            showResults(imageBlob, uploadedFiles[currentFileIndex].file.name);

            // 自动切换到下一张未处理的图片
            const nextIndex = uploadedFiles.findIndex((item, index) => 
                index > currentFileIndex && !item.processed
            );
            
            if (nextIndex !== -1) {
                startEditingImage(nextIndex);
            } else {
                imageEditor.style.display = 'none';
                currentFileIndex = -1;
            }

        } catch (error) {
            console.error('图片处理失败:', error);
            alert('图片处理失败，请重试');
        }
    });

    // 批量处理按钮
    batchProcessBtn.addEventListener('click', async () => {
        const unprocessedFiles = uploadedFiles.filter(item => !item.processed);
        for (const item of unprocessedFiles) {
            const index = uploadedFiles.indexOf(item);
            startEditingImage(index);
            await new Promise(resolve => setTimeout(resolve, 500)); // 等待裁剪器初始化
            await processBtn.click();
        }
    });

    // 显示处理结��
    function showResults(imageBlob, filename) {
        processedImages.push({
            blob: imageBlob,
            filename: filename
        });
        
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        resultCard.innerHTML = `
            <div class="result-preview">
                <h4>${filename}</h4>
                <img src="${URL.createObjectURL(imageBlob)}" alt="处理后图片">
                <div class="file-info">
                    <span>尺寸: 800×800</span>
                    <span>大小: ${formatFileSize(imageBlob.size)}</span>
                </div>
            </div>
        `;

        resultsContainer.querySelector('.results-grid').appendChild(resultCard);
        resultsContainer.style.display = 'block';
    }

    // 下载所有图片
    downloadAllBtn.addEventListener('click', () => {
        processedImages.forEach(({blob, filename}) => {
            const baseName = filename.replace(/\.[^/.]+$/, "");
            downloadBlob(blob, `${baseName}_800x800.jpg`);
        });
    });

    // 下载单个文件
    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}); 