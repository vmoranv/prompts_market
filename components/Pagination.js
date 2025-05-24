import React from 'react';
import styles from '../styles/Pagination.module.css'; // 确保路径正确

// 一个基本的 Pagination 组件
export default function Pagination({ currentPage, totalPages, onPageChange }) {
  // 如果总页数小于等于 1，则不显示分页
  if (totalPages <= 1) {
    return null;
  }

  // 生成页码数组
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className={styles.pagination}>
      {/* 首页按钮 */}
      <button
        className={styles.pageButton}
        onClick={() => onPageChange(1)} // 点击跳转到第一页
        disabled={currentPage === 1} // 当前页是第一页时禁用
      >
        首页
      </button>

      {/* 上一页按钮 */}
      <button
        className={styles.pageButton}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        上一页
      </button>

      {/* 页码按钮 */}
      {pages.map(page => (
        <button
          key={page}
          className={`${styles.pageButton} ${currentPage === page ? styles.active : ''}`}
          onClick={() => onPageChange(page)}
          disabled={currentPage === page}
        >
          {page}
        </button>
      ))}

      {/* 下一页按钮 */}
      <button
        className={styles.pageButton}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        下一页
      </button>

      {/* 尾页按钮 */}
      <button
        className={styles.pageButton}
        onClick={() => onPageChange(totalPages)} // 点击跳转到最后一页
        disabled={currentPage === totalPages} // 当前页是最后一页时禁用
      >
        尾页
      </button>
    </div>
  );
} 