import {
    BanIcon,
    DownloadIcon,
    Edit2Icon,
    KeyIcon,
    ListFilterIcon,
    MoreHorizontalIcon,
    Trash2Icon,
    UsersIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    avatar: string;
    lastLogin?: string;
    dateAdded: string;
    status: "active" | "inactive" | "pending";
}

const users: User[] = [
    {
        id: "USR-001",
        name: "Alice Johnson",
        email: "alice.j@example.com",
        role: "Admin",
        department: "Engineering",
        avatar: "https://i.pravatar.cc/150?u=alice",
        lastLogin: "2026-10-24T10:30:00Z",
        dateAdded: "2021-03-15T00:00:00Z",
        status: "active",
    },
    {
        id: "USR-002",
        name: "Bob Smith",
        email: "bob.smith@example.com",
        role: "Editor",
        department: "Marketing",
        avatar: "https://i.pravatar.cc/150?u=bob",
        lastLogin: "2026-10-23T14:15:00Z",
        dateAdded: "2025-06-10T00:00:00Z",
        status: "active",
    },
    {
        id: "USR-003",
        name: "Charlie Davis",
        email: "charlie.d@example.com",
        role: "Viewer",
        department: "Sales",
        avatar: "https://i.pravatar.cc/150?u=charlie",
        lastLogin: "2026-10-10T09:00:00Z",
        dateAdded: "2026-01-20T00:00:00Z",
        status: "inactive",
    },
    {
        id: "USR-004",
        name: "Diana Prince",
        email: "diana.p@example.com",
        role: "Editor",
        department: "Design",
        avatar: "https://i.pravatar.cc/150?u=diana",
        lastLogin: "2026-10-24T16:45:00Z",
        dateAdded: "2026-08-05T00:00:00Z",
        status: "active",
    },
    {
        id: "USR-005",
        name: "Evan Wright",
        email: "evan.w@example.com",
        role: "Viewer",
        department: "Engineering",
        avatar: "https://i.pravatar.cc/150?u=evan",
        dateAdded: "2026-10-25T00:00:00Z",
        status: "pending",
    },
];

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
};

export const SimpleUsersTable = () => {
    return (
        <Card className="w-full gap-5 pb-5 max-md:py-4!">
            <CardHeader className="max-md:px-4">
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage your team members and their account permissions.</CardDescription>
                <CardAction>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon-sm" aria-label="Filter" className="max-md:hidden">
                            <ListFilterIcon className="size-3.5" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button size="icon-sm" variant="outline" aria-label="Menu">
                                        <MoreHorizontalIcon className="size-4" />
                                    </Button>
                                }
                            />
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Table Actions</DropdownMenuLabel>
                                    <DropdownMenuItem>
                                        <DownloadIcon className="size-4" />
                                        Export Users
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <UsersIcon className="size-4" />
                                        Manage Roles
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant="destructive">
                                        <Trash2Icon className="size-4" />
                                        Bulk Delete
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardAction>
            </CardHeader>
            <CardContent className="max-md:px-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">Avatar</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date Added</TableHead>
                            <TableHead>Last Login</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user.avatar} alt={user.name} />
                                        <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </TableCell>

                                <TableCell>
                                    <div className="flex flex-col">
                                        <p className="truncate font-medium">{user.name}</p>
                                        <p className="text-muted-foreground text-xs">{user.email}</p>
                                    </div>
                                </TableCell>

                                <TableCell>
                                    <span className="text-sm">{user.department}</span>
                                </TableCell>

                                <TableCell>
                                    <span className="text-sm">{user.role}</span>
                                </TableCell>

                                <TableCell>
                                    <Badge
                                        variant={
                                            user.status === "inactive"
                                                ? "destructive"
                                                : user.status === "active"
                                                  ? "default"
                                                  : "secondary"
                                        }
                                        className="whitespace-nowrap capitalize">
                                        {user.status}
                                    </Badge>
                                </TableCell>

                                <TableCell>
                                    <span className="text-muted-foreground text-sm">{formatDate(user.dateAdded)}</span>
                                </TableCell>

                                <TableCell>
                                    <span className="text-muted-foreground text-sm">
                                        {user.lastLogin ? formatDate(user.lastLogin) : "Never"}
                                    </span>
                                </TableCell>

                                <TableCell className="text-end">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            render={
                                                <Button variant="ghost" size="icon-sm">
                                                    <MoreHorizontalIcon className="size-4" />
                                                    <span className="sr-only">Open menu</span>
                                                </Button>
                                            }
                                        />
                                        <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem>
                                                <Edit2Icon className="size-4" />
                                                Edit Profile
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <KeyIcon className="size-4" />
                                                Reset Password
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem>
                                                <BanIcon className="size-4" />
                                                Suspend User
                                            </DropdownMenuItem>
                                            <DropdownMenuItem variant="destructive">
                                                <Trash2Icon className="size-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
