import React, { useState, useEffect } from "react";
import { Button, Table, Input, Modal, message, Pagination } from "antd";
import { DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

interface Log {
  id: number;
  user: string;
  time: string;
  message: string;
  attachments: string[];
  guild: string;
  channel: string;
}

export default function App() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const pageSize = 10;

  useEffect(() => {
    fetchLogs();
    socket.on("new_log", handleNewLog);
    return () => {
      socket.off("new_log", handleNewLog);
    };
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/logs");
      const data = await response.json();
      setLogs(data);
      setFilteredLogs(data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching logs:", error);
      setIsLoading(false);
    }
  };

  const handleNewLog = (data: { log: Log }) => {
    setLogs((prevLogs) => [data.log, ...prevLogs]);
    setFilteredLogs((prevFilteredLogs) => [data.log, ...prevFilteredLogs]);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const filtered = logs.filter(
      (log) =>
        log.user.toLowerCase().includes(value.toLowerCase()) ||
        log.message.toLowerCase().includes(value.toLowerCase()) ||
        log.guild.toLowerCase().includes(value.toLowerCase()) ||
        log.channel.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const handleDeleteSelected = async () => {
    try {
      const response = await fetch("/api/delete_selected_logs", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: selectedLogs }),
      });
      if (response.ok) {
        message.success("Selected logs deleted successfully");
        fetchLogs();
        setSelectedLogs([]);
        setIsDeleteModalVisible(false);
      } else {
        message.error("Failed to delete selected logs");
      }
    } catch (error) {
      console.error("Error deleting selected logs:", error);
      message.error("Failed to delete selected logs");
    }
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch("/api/delete_all_logs", {
        method: "DELETE",
      });
      if (response.ok) {
        message.success("All logs deleted successfully");
        fetchLogs();
        setSelectedLogs([]);
        setIsDeleteModalVisible(false);
      } else {
        message.error("Failed to delete all logs");
      }
    } catch (error) {
      console.error("Error deleting all logs:", error);
      message.error("Failed to delete all logs");
    }
  };

  const columns = [
    {
      title: "User",
      dataIndex: "user",
      key: "user",
    },
    {
      title: "Time",
      dataIndex: "time",
      key: "time",
    },
    {
      title: "Message",
      dataIndex: "message",
      key: "message",
    },
    {
      title: "Attachments",
      dataIndex: "attachments",
      key: "attachments",
      render: (attachments: string[]) =>
        attachments && attachments.length > 0 ? (
          <div className="flex flex-wrap">
            {attachments.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-2 mb-2"
              >
                <img
                  src={url}
                  alt="Attachment"
                  className="w-16 h-16 object-cover rounded"
                />
              </a>
            ))}
          </div>
        ) : (
          "No Attachments"
        ),
    },
    {
      title: "Guild",
      dataIndex: "guild",
      key: "guild",
    },
    {
      title: "Channel",
      dataIndex: "channel",
      key: "channel",
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedLogs,
    onChange: (selectedRowKeys: number[]) => {
      setSelectedLogs(selectedRowKeys);
    },
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Message Logs</h1>
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center">
          <Input
            placeholder="Search logs"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="mr-2"
            prefix={<SearchOutlined />}
          />
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={() => setIsDeleteModalVisible(true)}
            disabled={selectedLogs.length === 0}
          >
            Delete Selected
          </Button>
        </div>
        <Button
          type="primary"
          danger
          onClick={() => setIsDeleteModalVisible(true)}
        >
          Delete All Logs
        </Button>
      </div>
      <Table
        dataSource={filteredLogs.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize
        )}
        columns={columns}
        rowKey="id"
        rowSelection={rowSelection}
        pagination={false}
        loading={isLoading}
      />
      <Pagination
        current={currentPage}
        total={filteredLogs.length}
        pageSize={pageSize}
        onChange={(page) => setCurrentPage(page)}
        className="mt-4 text-center"
      />
      <Modal
        title="Confirm Deletion"
        visible={isDeleteModalVisible}
        onOk={selectedLogs.length > 0 ? handleDeleteSelected : handleDeleteAll}
        onCancel={() => setIsDeleteModalVisible(false)}
        okText="Delete"
        cancelText="Cancel"
      >
        <p>
          {selectedLogs.length > 0
            ? `Are you sure you want to delete ${selectedLogs.length} selected log(s)?`
            : "Are you sure you want to delete all logs?"}
        </p>
      </Modal>
    </div>
  );
}
