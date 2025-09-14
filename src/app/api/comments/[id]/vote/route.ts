import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Vote = "UPVOTE" | "DOWNVOTE";

function getClientIP(req: Request) {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { voteType } = (await req.json()) as { voteType: Vote };
    if (voteType !== "UPVOTE" && voteType !== "DOWNVOTE") {
      return NextResponse.json({ error: "Invalid voteType" }, { status: 400 });
    }

    const ip = getClientIP(req);
    const commentId = params.id;

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load comment
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { id: true, upvotes: true, downvotes: true },
      });
      if (!comment) {
        return { status: 404 as const, body: { error: "Comment not found" } };
      }

      // 2) Load existing vote by composite unique (commentId, voterIP).
      // If your Prisma model has @@unique([commentId, voterIP]) this will work.
      // (If not, the catch fallback uses findFirst.)
      let existing = await tx.commentVote
        .findUnique({
          where: { commentId_voterIP: { commentId: comment.id, voterIP: ip } },
        })
        .catch(() =>
          tx.commentVote.findFirst({
            where: { commentId: comment.id, voterIP: ip },
          })
        );

      // 3) Apply voting rules
      if (!existing) {
        // Create new vote (NO updatedAt — your table doesn't have it)
        await tx.commentVote.create({
          data: {
            id: crypto.randomUUID(),
            commentId: comment.id,
            voterIP: ip,
            voteType, // enum in DB
            createdAt: new Date(), // your table has this
          },
        });

        // increment the corresponding counter
        if (voteType === "UPVOTE") {
          await tx.comment.update({
            where: { id: comment.id },
            data: { upvotes: { increment: 1 }, updatedAt: new Date() },
          });
        } else {
          await tx.comment.update({
            where: { id: comment.id },
            data: { downvotes: { increment: 1 }, updatedAt: new Date() },
          });
        }
      } else if (existing.voteType === voteType) {
        // Toggle off (same vote twice) => remove vote + decrement the counter
        await tx.commentVote.delete({ where: { id: existing.id } });

        if (voteType === "UPVOTE") {
          await tx.comment.update({
            where: { id: comment.id },
            data: { upvotes: { decrement: 1 }, updatedAt: new Date() },
          });
        } else {
          await tx.comment.update({
            where: { id: comment.id },
            data: { downvotes: { decrement: 1 }, updatedAt: new Date() },
          });
        }
      } else {
        // Switch vote (UPVOTE -> DOWNVOTE or vice versa)
        await tx.commentVote.update({
          where: { id: existing.id },
          data: {
            voteType, // only change the enum
            // DO NOT set updatedAt here — the table doesn't have it
          },
        });

        if (voteType === "UPVOTE") {
          await tx.comment.update({
            where: { id: comment.id },
            data: {
              upvotes: { increment: 1 },
              downvotes: { decrement: 1 },
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.comment.update({
            where: { id: comment.id },
            data: {
              downvotes: { increment: 1 },
              upvotes: { decrement: 1 },
              updatedAt: new Date(),
            },
          });
        }
      }

      // Return fresh counts
      const refreshed = await tx.comment.findUnique({
        where: { id: comment.id },
        select: { id: true, upvotes: true, downvotes: true },
      });

      return { status: 200 as const, body: refreshed };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    console.error("Comment vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}